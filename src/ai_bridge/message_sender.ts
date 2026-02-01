import { IMessageSender } from '../skills/base/SkillBase';
import { Telegraf } from 'telegraf';

/**
 * Implémentation simple de IMessageSender pour le contexte sans Telegram (cron, etc.)
 * Utilise une instance statique du bot Telegraf
 */
export class CronMessageSender implements IMessageSender {
    private telegrafInstance: Telegraf | null = null;

    /**
     * Définit l'instance Telegraf à utiliser pour envoyer les messages
     */
    public setTelegrafInstance(bot: Telegraf): void {
        this.telegrafInstance = bot;
    }

    /**
     * Envoie un message via Telegram
     */
    public async sendMessage(userId: string, message: string, parseMode?: 'MarkdownV2' | 'Markdown' | 'HTML'): Promise<void> {
        if (!this.telegrafInstance) {
            console.error('[CRON_MESSAGE_SENDER] Pas d\'instance Telegraf disponible');
            return;
        }

        try {
            const options = parseMode ? { parse_mode: parseMode } : {};
            await this.telegrafInstance.telegram.sendMessage(userId, message, options);
            console.log(`[CRON_MESSAGE_SENDER] Message envoyé à l'utilisateur ${userId}`);
        } catch (error) {
            console.error(`[CRON_MESSAGE_SENDER] Erreur lors de l'envoi du message à ${userId}:`, error);
        }
    }
}

// Instance singleton
export const cronMessageSender = new CronMessageSender();
