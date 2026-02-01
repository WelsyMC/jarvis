import { SkillBase, SkillData, SkillDetectionResult, SkillExecutionResult } from "../base/SkillBase";
import { Context, NarrowedContext } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";

/**
 * Interface pour les données du skill System Info
 */
export interface SystemInfoSkillData extends SkillData {
    infoType: 'time' | 'date' | 'uptime' | 'memory' | 'all';
}

/**
 * Skill d'exemple pour obtenir des informations système
 * Démontre la facilité d'ajout de nouveaux skills
 */
export class SystemInfoSkill extends SkillBase {
    public readonly name = "system_info";
    public readonly description = "Fournit des informations système (date, heure, mémoire, etc.)";

    /**
     * Détecte si ce skill doit être utilisé
     */
    public detectSkill(skillDetection: string): SkillDetectionResult {
        const systemMatch = skillDetection.match(/\[SKILL:\s*system_info\]/i);
        if (!systemMatch) {
            return { isDetected: false };
        }

        // Déterminer le type d'information demandé
        const typeMatch = skillDetection.match(/Type:\s*"([^"]+)"/i);
        let infoType: SystemInfoSkillData['infoType'] = 'all';

        if (typeMatch) {
            const requestedType = typeMatch[1].toLowerCase();
            if (['time', 'date', 'uptime', 'memory', 'all'].includes(requestedType)) {
                infoType = requestedType as SystemInfoSkillData['infoType'];
            }
        }

        return {
            isDetected: true,
            data: {
                infoType: infoType
            }
        };
    }

    /**
     * Exécute le skill system info
     */
    public async execute(
        data: SkillData,
        ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>,
        userId: string
    ): Promise<SkillExecutionResult> {
        try {
            const systemData = data as SystemInfoSkillData;

            if (!this.validateData(systemData)) {
                return {
                    success: false,
                    error: "Données invalides pour le skill system_info"
                };
            }

            const systemInfo = this.getSystemInfo(systemData.infoType);
            const formattedMessage = this.formatSystemInfo(systemInfo, systemData.infoType);

            return {
                success: true,
                message: formattedMessage,
                requiresResponse: true,
                responseData: { systemInfo }
            };

        } catch (error) {
            console.error("[SYSTEM_INFO_SKILL] Erreur lors de l'exécution:", error);
            return {
                success: false,
                error: "Erreur lors de la récupération des informations système"
            };
        }
    }

    /**
     * Valide les données du skill
     */
    public validateData(data: SkillData): boolean {
        const systemData = data as SystemInfoSkillData;
        return !!(systemData.infoType && ['time', 'date', 'uptime', 'memory', 'all'].includes(systemData.infoType));
    }

    /**
     * Récupère les informations système demandées
     */
    private getSystemInfo(infoType: SystemInfoSkillData['infoType']): any {
        const now = new Date();
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        const info = {
            time: now.toLocaleTimeString('fr-FR'),
            date: now.toLocaleDateString('fr-FR'),
            uptime: this.formatUptime(uptime),
            memory: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
            }
        };

        if (infoType === 'all') {
            return info;
        }

        return { [infoType]: info[infoType] };
    }

    /**
     * Formate l'uptime en texte lisible
     */
    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}j`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

        return parts.join(' ');
    }

    /**
     * Formate les informations système pour l'affichage
     */
    private formatSystemInfo(systemInfo: any, infoType: SystemInfoSkillData['infoType']): string {
        let message = "🖥️ **Informations système**\n\n";

        if (infoType === 'all') {
            message += `⏰ **Heure**: ${systemInfo.time}\n`;
            message += `📅 **Date**: ${systemInfo.date}\n`;
            message += `⏱️ **Uptime**: ${systemInfo.uptime}\n`;
            message += `💾 **Mémoire**:\n`;
            message += `   • RSS: ${systemInfo.memory.rss}\n`;
            message += `   • Heap Total: ${systemInfo.memory.heapTotal}\n`;
            message += `   • Heap Used: ${systemInfo.memory.heapUsed}\n`;
            message += `   • External: ${systemInfo.memory.external}`;
        } else if (infoType === 'memory') {
            message += `💾 **Mémoire**:\n`;
            message += `   • RSS: ${systemInfo.memory.rss}\n`;
            message += `   • Heap Total: ${systemInfo.memory.heapTotal}\n`;
            message += `   • Heap Used: ${systemInfo.memory.heapUsed}\n`;
            message += `   • External: ${systemInfo.memory.external}`;
        } else {
            const labels = {
                time: '⏰ **Heure**',
                date: '📅 **Date**',
                uptime: '⏱️ **Uptime**'
            };
            message += `${labels[infoType]}: ${systemInfo[infoType]}`;
        }

        return message;
    }
}