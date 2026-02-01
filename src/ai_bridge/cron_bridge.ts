/**
 * Cron Bridge - Permet de planifier des tâches qui seront exécutées après un délai
 */

import { sendMessageToAI } from './ai_bridge';

interface ScheduledTask {
    id: string;
    originalPrompt: string;
    userId: string;
    scheduledAt: Date;
    executeAt: Date;
    timeout: NodeJS.Timeout;
    executed: boolean;
}

export class CronBridge {
    private tasks: Map<string, ScheduledTask> = new Map();
    private onTaskComplete: (userId: string, response: string) => Promise<void>;

    constructor() {
        this.onTaskComplete = async () => {};
    }

    /**
     * Définit le callback qui sera appelé quand une tâche planifiée est exécutée
     * @param callback Fonction qui envoie le résultat à l'utilisateur
     */
    public setTaskCompleteCallback(callback: (userId: string, response: string) => Promise<void>) {
        this.onTaskComplete = callback;
    }

    /**
     * Planifie une nouvelle tâche
     * @param prompt Le prompt original à redonner à l'IA
     * @param delaySeconds Délai en secondes avant l'exécution
     * @param userId ID de l'utilisateur Telegram
     * @returns ID de la tâche créée
     */
    public scheduleTask(prompt: string, delaySeconds: number, userId: string): string {
        const taskId = this.generateTaskId();
        const now = new Date();
        const executeAt = new Date(now.getTime() + delaySeconds * 1000);

        console.log(`[CRON] Planification d'une tâche: "${prompt}" dans ${delaySeconds}s pour l'utilisateur ${userId}`);

        const timeout = setTimeout(async () => {
            await this.executeTask(taskId);
        }, delaySeconds * 1000);

        const task: ScheduledTask = {
            id: taskId,
            originalPrompt: prompt,
            userId,
            scheduledAt: now,
            executeAt,
            timeout,
            executed: false
        };

        this.tasks.set(taskId, task);
        return taskId;
    }

    /**
     * Exécute une tâche planifiée
     */
    private async executeTask(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task || task.executed) {
            return;
        }

        console.log(`[CRON] Exécution de la tâche: "${task.originalPrompt}"`);
        task.executed = true;

        try {
            // Re-donner le prompt original à l'IA
            const aiResponse = await sendMessageToAI(task.originalPrompt);
            
            // Envoyer la réponse à l'utilisateur via Telegram
            await this.onTaskComplete(task.userId, aiResponse);
            
            console.log(`[CRON] Tâche complétée avec succès: ${taskId}`);
        } catch (error) {
            console.error(`[CRON] Erreur lors de l'exécution de la tâche ${taskId}:`, error);
            await this.onTaskComplete(task.userId, "Désolé, une erreur s'est produite lors de l'exécution de la tâche planifiée.");
        } finally {
            // Nettoyer la tâche après exécution
            this.tasks.delete(taskId);
        }
    }

    /**
     * Annule une tâche planifiée
     */
    public cancelTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        clearTimeout(task.timeout);
        this.tasks.delete(taskId);
        console.log(`[CRON] Tâche annulée: ${taskId}`);
        return true;
    }

    /**
     * Récupère toutes les tâches planifiées
     */
    public getAllTasks(): ScheduledTask[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Récupère les tâches d'un utilisateur spécifique
     */
    public getUserTasks(userId: string): ScheduledTask[] {
        return Array.from(this.tasks.values()).filter(task => task.userId === userId);
    }

    /**
     * Génère un ID unique pour une tâche
     */
    private generateTaskId(): string {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Parse une demande de cron depuis la réponse de l'IA
     * Format attendu: [USE_SKILL: cron] Prompt: "le prompt à réexécuter" | Délai: XXs/XXm/XXh
     * @returns null si parsing échoue, sinon un objet avec prompt et délai
     */
    public static parseCronRequest(aiResponse: string): { prompt: string; delaySeconds: number } | null {
        // Chercher le pattern [USE_SKILL: cron]
        const skillMatch = aiResponse.match(/\[USE_SKILL:\s*cron\]/i);
        if (!skillMatch) {
            return null;
        }

        // Extraire le prompt entre guillemets
        const promptMatch = aiResponse.match(/Prompt:\s*"([^"]+)"/i);
        if (!promptMatch) {
            return null;
        }

        // Extraire le délai (accepte "Délai" ou "Delai")
        const delayMatch = aiResponse.match(/D[eé]lai:\s*(\d+)(s|m|h)/i);
        if (!delayMatch) {
            return null;
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
        }

        return {
            prompt: promptMatch[1],
            delaySeconds
        };
    }
}

// Instance singleton
export const cronBridge = new CronBridge();
