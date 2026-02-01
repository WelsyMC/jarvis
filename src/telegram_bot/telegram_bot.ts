import { Context, NarrowedContext, Telegraf } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";
import { sendMessageToAI, detectSkills } from "../ai_bridge/ai_bridge";
import { cronBridge } from "../ai_bridge/cron_bridge";
import { skillManager } from "../skills";

export class TelegramBot {
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
        cronBridge.setTaskCompleteCallback(async (userId: string, response: string) => {
            await this.sendMessageToUser(userId, response);
        });
    }

    /**
     * Envoie un message à un utilisateur spécifique
     */
    public async sendMessageToUser(userId: string, message: string, parseMode?: 'MarkdownV2' | 'Markdown' | 'HTML'): Promise<void> {
        try {
            const options = parseMode ? { parse_mode: parseMode } : {};
            await this.bot.telegram.sendMessage(userId, message, options);
            console.log(`[TELEGRAM] Message envoyé à l'utilisateur ${userId}`);
        } catch (error) {
            console.error(`[TELEGRAM] Erreur lors de l'envoi du message à ${userId}:`, error);
        }
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
                    const skillResult = await skillManager.processSkillDetection(skillDetection, ctx, userId);

                    if (skillResult) {
                        // Un skill a été exécuté
                        if (skillResult.success && skillResult.requiresResponse && skillResult.message) {
                            // si le skill n'est pas web_search, regarder si il faut envoyer toutes les infos ou juste une partie
                            if ("web_search" !== skillResult.responseData?.skillName) {
                                // Sûrement un skill système du coup, on filtre ce qu'il y a a savoir.
                                const aiFinalAnswer = await sendMessageToAI(
                                    `Analyse la question que je vais te poser, analyse la réponse que je te donne, et réponds moi seulement avec les informations qui m'intéressent.
                                    
                                    Question: ${text}
                                    Réponse à filtrer: ${skillResult.message}
                                    `
                                );

                                const parseMode = aiFinalAnswer.includes('*') || aiFinalAnswer.includes('_') ? 'MarkdownV2' : undefined;
                                await ctx.reply(`💬 Réponse:\n\n${aiFinalAnswer}`, parseMode ? { parse_mode: parseMode } : {});
                            } else {
                                // Skill web_search, formater la réponse
                                const parseMode = skillResult.message.includes('*') || skillResult.message.includes('_') ? 'MarkdownV2' : undefined;
                                await ctx.reply(`💬 Réponse:\n\n${skillResult.message}`, parseMode ? { parse_mode: parseMode } : {});
                            }

                        } else if (!skillResult.success && skillResult.error) {
                            // Afficher l'erreur
                            await ctx.reply(skillResult.error);
                        }
                    } else {
                        // Aucun skill nécessaire, conversation normale
                        const aiResponse = await sendMessageToAI(text);
                        await ctx.reply(aiResponse);
                    }
                    console.log("=".repeat(50));
                } catch (error) {
                    console.error("[TELEGRAM] Erreur lors du traitement:", error);
                    ctx.reply("Sorry, there was an error processing your request.");
                }
            });
            return;
        }
    }

    public launch() {
        this.bot.launch();
        console.log("Bot Telegram démarré et en écoute des messages privés...");
        console.log(`Skills disponibles: ${skillManager.getSkills().map(s => s.name).join(', ')}`);

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
