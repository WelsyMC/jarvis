import { SkillBase, SkillData, SkillDetectionResult, SkillExecutionResult } from "../base/SkillBase";
import { Context, NarrowedContext } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";
import { CronBridge, cronBridge } from "../../ai_bridge/cron_bridge";
import { sendMessageToAI } from "../../ai_bridge/ai_bridge";

/**
 * Interface pour les données du skill Cron
 */
export interface CronSkillData extends SkillData {
    prompt: string;
    delaySeconds: number;
}

/**
 * Skill pour la planification de tâches avec cron
 */
export class CronSkill extends SkillBase {
    public readonly name = "cron";
    public readonly description = "Planifie des rappels et des tâches différées";

    /**
     * Détecte si ce skill doit être utilisé
     */
    public detectSkill(skillDetection: string): SkillDetectionResult {
        const cronMatch = skillDetection.match(/\[SKILL:\s*cron\]/i);
        if (!cronMatch) {
            return { isDetected: false };
        }

        const promptMatch = skillDetection.match(/Prompt:\s*"([^"]+)"/i);
        const delayMatch = skillDetection.match(/D[eé]lai:\s*(\d+)(s|m|h)/i);

        if (!promptMatch || !delayMatch) {
            return { isDetected: false };
        }

        const delayValue = parseInt(delayMatch[1]);
        const delayUnit = delayMatch[2].toLowerCase();

        let delaySeconds = 0;
        switch (delayUnit) {
            case 's':
                delaySeconds = delayValue;
                break;
            case 'm':
                delaySeconds = delayValue * 60;
                break;
            case 'h':
                delaySeconds = delayValue * 60 * 60;
                break;
            default:
                return { isDetected: false };
        }

        return {
            isDetected: true,
            data: {
                prompt: promptMatch[1],
                delaySeconds: delaySeconds
            }
        };
    }

    /**
     * Exécute le skill cron
     */
    public async execute(
        data: SkillData,
        ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>,
        userId: string
    ): Promise<SkillExecutionResult> {
        try {
            const cronData = data as CronSkillData;

            if (!this.validateData(cronData)) {
                return {
                    success: false,
                    error: "Données invalides pour le skill cron"
                };
            }

            // Planifier la tâche cron
            const taskId = cronBridge.scheduleTask(
                cronData.prompt,
                cronData.delaySeconds,
                userId
            );

            // Générer une confirmation avec l'IA
            const delayText = this.formatDelay(cronData.delaySeconds);
            const confirmationPrompt = `L'utilisateur a demandé un rappel. Confirme-lui brièvement que tu lui enverras un message dans ${delayText}.`;
            const confirmation = await sendMessageToAI(confirmationPrompt);

            return {
                success: true,
                message: confirmation,
                requiresResponse: true,
                responseData: { taskId, delayText }
            };

        } catch (error) {
            console.error("[CRON_SKILL] Erreur lors de l'exécution:", error);
            return {
                success: false,
                error: "Erreur lors de la planification de la tâche"
            };
        }
    }

    /**
     * Valide les données du skill
     */
    public validateData(data: SkillData): boolean {
        const cronData = data as CronSkillData;
        return !!(cronData.prompt && 
                 typeof cronData.delaySeconds === 'number' && 
                 cronData.delaySeconds > 0);
    }

    /**
     * Formate le délai en texte lisible
     */
    private formatDelay(seconds: number): string {
        if (seconds < 60) {
            return `${seconds} seconde${seconds > 1 ? 's' : ''}`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        } else {
            const hours = Math.floor(seconds / 3600);
            return `${hours} heure${hours > 1 ? 's' : ''}`;
        }
    }
}