import { Context, NarrowedContext, Telegraf } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";
import { sendMessageToAI, detectSkills } from "../ai_bridge/ai_bridge";
import { cronBridge } from "../ai_bridge/cron_bridge";
import { cronMessageSender } from "../ai_bridge/message_sender";
import { getSkillManager } from "../skills";
import { IMessageSender } from "../skills/base/SkillBase";

export class TelegramBot implements IMessageSender {
    private bot: Telegraf;
    private allowedUserId: string;

    constructor(botToken: string) {
        if (!botToken) {
            throw new Error("Bot token is required");
        }
        this.bot = new Telegraf(botToken);
        this.allowedUserId = process.env.TELEGRAM_ALLOWED_USER_ID || "";
        this.setupHandlers();
        this.setupCronBridge();
    }

    /**
     * Configure le callback du cron bridge pour envoyer des messages
     */
    private setupCronBridge() {
        // Initialiser le message sender pour le cron
        cronMessageSender.setTelegrafInstance(this.bot);
        
        cronBridge.setTaskCompleteCallback(async (userId: string, response: string) => {
            await this.sendMessageToUser(userId, response);
        });
    }

    /**
     * Envoie un message à un utilisateur spécifique (implémente IMessageSender)
     */
    public async sendMessage(userId: string, message: string, parseMode?: 'MarkdownV2' | 'Markdown' | 'HTML'): Promise<void> {
        try {
            const options = parseMode ? { parse_mode: parseMode } : {};
            await this.bot.telegram.sendMessage(userId, message, options);
            console.log(`[TELEGRAM] Message envoyé à l'utilisateur ${userId}`);
        } catch (error) {
            console.error(`[TELEGRAM] Erreur lors de l'envoi du message à ${userId}:`, error);
        }
    }

    /**
     * Alias pour rétrocompatibilité
     */
    public async sendMessageToUser(userId: string, message: string, parseMode?: 'MarkdownV2' | 'Markdown' | 'HTML'): Promise<void> {
        return this.sendMessage(userId, message, parseMode);
    }

    private setupHandlers() {
        // Gérer les messages privés (DM)
        this.bot.on("message", (ctx) => {
            if (ctx.from.id !== parseInt(this.allowedUserId)) return;

            // Vérifier si c'est un message privé (pas dans un groupe)
            if (ctx.chat.type === "private") {
                this.handlePrivateMessage(ctx);
            }
        });
    }

    /**
     * Gère les messages privés reçus
     */
    private handlePrivateMessage(ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>) {
        if ("text" in ctx.message) {
            let text = ctx.message.text;
            const userId = ctx.from.id.toString();

            console.log("=".repeat(50));
            console.log(`[TELEGRAM] Message reçu de ${ctx.from.username || ctx.from.id}: ${text}`);
            ctx.sendChatAction("typing").then(async () => {
                try {
                    // ÉTAPE 1: Détection des skills
                    const skillDetection = await detectSkills(text);

                    // Afficher le message de détection sur Telegram
                    await ctx.reply(`🔍 Détection de skills:\n\n${skillDetection}`);

                    // ÉTAPE 2: Traitement via le gestionnaire de skills
                    const skillResult = await getSkillManager().processSkillDetection(skillDetection, this, userId);

                    if (skillResult) {
                        // Un ou plusieurs skills ont été exécutés
                        if (skillResult.success && skillResult.requiresResponse && skillResult.message) {
                            // Vérifier si c'est un skill cron - ne pas répondre avec les données du cron
                            const isCronSkill = skillResult.responseData?.skillName === 'cron' || 
                                               (skillResult.responseData?.skillNames && skillResult.responseData.skillNames.includes('cron'));
                            
                            // Pour le cron, on envoie directement la confirmation
                            if (isCronSkill && !skillResult.responseData?.multiSkill) {
                                await ctx.reply(`⏰ ${skillResult.message}`);
                            }
                            // Pour web_search ou multi-skills avec web_search, formater la réponse
                            else if (skillResult.responseData?.skillName === 'web_search' || 
                                    (skillResult.responseData?.skillNames && skillResult.responseData.skillNames.includes('web_search'))) {
                                const parseMode = skillResult.message.includes('*') || skillResult.message.includes('_') ? 'MarkdownV2' : undefined;
                                await ctx.reply(`💬 Réponse:\n\n${skillResult.message}`, parseMode ? { parse_mode: parseMode } : {});
                            }
                            // Traitement spécifique pour Gmail
                            else if (skillResult.responseData?.skillName === 'gmail') {
                                const aiFinalAnswer = await sendMessageToAI(
                                    `Tu dois résumer ou présenter des e-mails. UTILISE UNIQUEMENT les données ci-dessous.

Demande de l'utilisateur: "${text}"

Voici les e-mails récupérés (DONNÉES RÉELLES - ne les invente pas):
${skillResult.message}

Réponds à la demande de l'utilisateur en te basant EXCLUSIVEMENT sur ces données. Si l'utilisateur demande un résumé, résume ces mails. Si il demande la liste, liste ces mails.`
                                );

                                await ctx.reply(`📧 ${aiFinalAnswer}`);
                            } else {
                                // Autre skill, filtrer ce qu'il y a à savoir
                                const aiFinalAnswer = await sendMessageToAI(
                                    `DONNÉES RÉELLES (ne les invente pas, utilise-les):
${skillResult.message}

Demande de l'utilisateur: "${text}"

Réponds en utilisant UNIQUEMENT les données ci-dessus. NE FABRIQUE PAS d'informations.`
                                );

                                const parseMode = aiFinalAnswer.includes('*') || aiFinalAnswer.includes('_') ? 'MarkdownV2' : undefined;
                                await ctx.reply(`💬 Réponse:\n\n${aiFinalAnswer}`, parseMode ? { parse_mode: parseMode } : {});
                            }

                        } else if (!skillResult.success && skillResult.error) {
                            // Afficher l'erreur
                            await ctx.reply(`❌ ${skillResult.error}`);
                        }
                    } else {
                        // Aucun skill nécessaire, conversation normale
                        const aiResponse = await sendMessageToAI(text);
                        await ctx.reply(aiResponse);
                    }
                    console.log("=".repeat(50));
                } catch (error) {
                    console.error("[TELEGRAM] Erreur lors du traitement:", error);
                    ctx.reply("Désolé, une erreur s'est produite lors du traitement de ta demande.");
                }
            });
            return;
        }
    }

    public launch() {
        this.bot.launch();
        console.log("Bot Telegram démarré et en écoute des messages privés...");
        console.log(`Skills disponibles: ${getSkillManager().getSkills().map(s => s.name).join(', ')}`);

        // Gérer l'arrêt propre du bot
        process.once("SIGINT", async () => {
            console.log("Arrêt du bot en cours...");
            this.bot.stop("SIGINT");
        });
        process.once("SIGTERM", async () => {
            console.log("Arrêt du bot en cours...");
            this.bot.stop("SIGTERM");
        });
    }

    public async stop(reason: string) {
        console.log(`Arrêt du bot: ${reason}`);
        this.bot.stop(reason);
    }
}
