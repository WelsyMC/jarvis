import { SkillBase, SkillData, SkillDetectionResult, SkillExecutionResult, IMessageSender } from "../base/SkillBase";
import { webSearchBridge, WebSearchResponse, WebSearchProgressCallback } from "../../ai_bridge/web_search_bridge";

/**
 * Interface pour les données du skill WebSearch
 */
export interface WebSearchSkillData extends SkillData {
    query: string;
}

/**
 * Skill pour la recherche web amélioré
 * - Visite réellement les sites (pas seulement les snippets)
 * - Continue à chercher jusqu'à trouver une réponse fiable
 * - Maximum 10 sites visités
 * - Affiche la progression en temps réel
 */
export class WebSearchSkill extends SkillBase {
    public readonly name = "web_search";
    public readonly description = "Effectue des recherches sur le web, visite les sites et synthétise les résultats";

    /**
     * Détecte si ce skill doit être utilisé
     */
    public detectSkill(skillDetection: string): SkillDetectionResult {
        const webSearchMatch = skillDetection.match(/\[SKILL:\s*web_search\]/i);
        if (!webSearchMatch) {
            return { isDetected: false };
        }

        const queryMatch = skillDetection.match(/Query:\s*"([^"]+)"/i);
        if (!queryMatch) {
            return { isDetected: false };
        }

        return {
            isDetected: true,
            data: {
                query: queryMatch[1]
            }
        };
    }

    /**
     * Exécute le skill de recherche web avec progression
     */
    public async execute(
        data: SkillData,
        userId: string,
        messageSender: IMessageSender
    ): Promise<SkillExecutionResult> {
        try {
            const searchData = data as WebSearchSkillData;

            if (!this.validateData(searchData)) {
                return {
                    success: false,
                    error: "Données invalides pour le skill web_search"
                };
            }

            // Message de progression initial
            const progressMessage = { id: 0, text: "🌐 Recherche web en cours...\n📊 Progression: 0/10 sites analysés" };
            await messageSender.sendMessage(userId, progressMessage.text);
            
            let lastProgressUpdate = Date.now();
            const minUpdateInterval = 2000; // Minimum 2s entre les mises à jour

            // Callback pour afficher la progression
            const onProgress: WebSearchProgressCallback = async (message, sitesVisited, maxSites) => {
                const now = Date.now();
                // Limiter les mises à jour pour ne pas surcharger Telegram
                if (now - lastProgressUpdate >= minUpdateInterval) {
                    try {
                        const progressText = `🌐 ${message}\n📊 Progression: ${sitesVisited}/${maxSites} sites analysés`;
                        await messageSender.sendMessage(userId, progressText);
                        lastProgressUpdate = now;
                    } catch (e) {
                        // Ignorer les erreurs de mise à jour du message
                    }
                }
            };

            // Effectuer la recherche web avec progression
            const searchResponse = await webSearchBridge.performWebSearch(
                searchData.query,
                onProgress
            );

            // Formater la réponse
            const formattedMessage = this.formatWebSearchResponse(searchResponse);

            return {
                success: true,
                message: formattedMessage,
                requiresResponse: true,
                responseData: { searchResponse, skillName: 'web_search' }
            };

        } catch (error) {
            console.error("[WEB_SEARCH_SKILL] Erreur lors de l'exécution:", error);
            return {
                success: false,
                error: "❌ Erreur lors de la recherche web. Veuillez réessayer plus tard."
            };
        }
    }

    /**
     * Valide les données du skill
     */
    public validateData(data: SkillData): boolean {
        const searchData = data as WebSearchSkillData;
        return !!(searchData.query && typeof searchData.query === 'string' && searchData.query.trim().length > 0);
    }

    /**
     * Formate la réponse de recherche web pour Telegram avec MarkdownV2
     */
    public formatWebSearchResponse(searchResponse: WebSearchResponse): string {
        // Échapper les caractères spéciaux pour MarkdownV2
        const escapeMarkdownV2 = (text: string) => {
            return text
                .replace(/\\/g, '\\\\')  // Échapper les backslashes en premier
                .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
        };

        let message = `🔍 Recherche: "${escapeMarkdownV2(searchResponse.query)}"\n\n`;

        // Ajouter la synthèse de l'IA
        message += `📝 *Synthèse:*\n${escapeMarkdownV2(searchResponse.summary)}\n\n`;

        // Ajouter les sources (seulement celles qui ont été utiles)
        const usefulSources = searchResponse.results.filter(r => r.snippet && r.snippet.length > 0);
        if (usefulSources.length > 0) {
            message += `📚 *Sources utilisées:*\n`;
            usefulSources.slice(0, 5).forEach((result, index) => {
                const escapedTitle = escapeMarkdownV2(result.title);
                message += `${index + 1}\\. [${escapedTitle}](${result.link})\n`;
            });
        }

        return message;
    }
}