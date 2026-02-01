import { ContentAnalysis, PageContent } from './types';

/**
 * Module d'analyse de contenu
 * Responsabilité: Demander à l'IA d'évaluer si un contenu répond à la question
 * 
 * IMPORTANT: Prompts courts et segmentés pour éviter de perdre le contexte de l'IA
 */
export class ContentAnalyzer {
    
    /**
     * Analyse si un contenu de page répond à la question posée
     * Utilise un prompt TRÈS court et précis pour l'IA locale
     */
    async analyzeContent(
        query: string, 
        pageContent: PageContent,
        sendToAI: (prompt: string) => Promise<string>
    ): Promise<ContentAnalysis> {
        try {
            console.log(`[CONTENT_ANALYZER] Analyse du contenu de: ${pageContent.url}`);

            // Limiter le contenu pour ne pas surcharger l'IA
            const truncatedContent = pageContent.content.substring(0, 3000);

            // Prompt court et structuré pour l'IA locale
            const analysisPrompt = `ANALYSE DE CONTENU WEB

QUESTION: "${query}"

CONTENU DU SITE:
${truncatedContent}

---
RÉPONDS EXACTEMENT DANS CE FORMAT:
PERTINENT: [OUI/NON]
CONFIANCE: [HAUTE/MOYENNE/BASSE]
INFO: [Résume en 2-3 phrases l'information trouvée si pertinente, sinon écris "Aucune info utile"]
RAISON: [Explique en 1 phrase pourquoi c'est pertinent ou non]`;

            const aiResponse = await sendToAI(analysisPrompt);
            
            // Parser la réponse de l'IA
            return this.parseAnalysisResponse(aiResponse);

        } catch (error) {
            console.error(`[CONTENT_ANALYZER] Erreur d'analyse:`, error);
            return {
                isRelevant: false,
                confidence: 'none',
                extractedInfo: '',
                reason: 'Erreur lors de l\'analyse'
            };
        }
    }

    /**
     * Parse la réponse de l'IA pour extraire les informations structurées
     */
    private parseAnalysisResponse(response: string): ContentAnalysis {
        const upperResponse = response.toUpperCase();
        
        // Déterminer si pertinent
        const isRelevant = upperResponse.includes('PERTINENT: OUI') || 
                          upperResponse.includes('PERTINENT:OUI') ||
                          (upperResponse.includes('PERTINENT') && upperResponse.includes('OUI'));

        // Déterminer le niveau de confiance
        let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
        if (upperResponse.includes('CONFIANCE: HAUTE') || upperResponse.includes('CONFIANCE:HAUTE')) {
            confidence = 'high';
        } else if (upperResponse.includes('CONFIANCE: MOYENNE') || upperResponse.includes('CONFIANCE:MOYENNE')) {
            confidence = 'medium';
        } else if (upperResponse.includes('CONFIANCE: BASSE') || upperResponse.includes('CONFIANCE:BASSE')) {
            confidence = 'low';
        }

        // Extraire l'info trouvée
        let extractedInfo = '';
        const infoMatch = response.match(/INFO:\s*(.+?)(?=\nRAISON:|$)/is);
        if (infoMatch) {
            extractedInfo = infoMatch[1].trim();
        }

        // Extraire la raison
        let reason = '';
        const reasonMatch = response.match(/RAISON:\s*(.+?)$/is);
        if (reasonMatch) {
            reason = reasonMatch[1].trim();
        }

        console.log(`[CONTENT_ANALYZER] Résultat: pertinent=${isRelevant}, confiance=${confidence}`);

        return {
            isRelevant,
            confidence,
            extractedInfo,
            reason
        };
    }

    /**
     * Vérifie si le niveau de confiance est suffisant
     */
    isConfidenceSufficient(
        analysis: ContentAnalysis, 
        minConfidence: 'high' | 'medium' | 'low'
    ): boolean {
        const confidenceLevels = { 'none': 0, 'low': 1, 'medium': 2, 'high': 3 };
        return confidenceLevels[analysis.confidence] >= confidenceLevels[minConfidence];
    }

    /**
     * Génère une synthèse finale à partir des informations collectées
     * Prompt séparé pour la synthèse finale
     */
    async generateFinalSynthesis(
        query: string,
        collectedInfo: { url: string; info: string }[],
        sendToAI: (prompt: string) => Promise<string>
    ): Promise<string> {
        console.log(`[CONTENT_ANALYZER] Génération de la synthèse finale avec ${collectedInfo.length} sources`);

        // Construire le contexte des informations collectées
        let infoContext = '';
        collectedInfo.forEach((item, index) => {
            infoContext += `SOURCE ${index + 1}:\n${item.info}\n\n`;
        });

        const synthesisPrompt = `SYNTHÈSE FINALE

QUESTION: "${query}"

INFORMATIONS COLLECTÉES:
${infoContext}

---
Rédige une réponse complète et précise basée UNIQUEMENT sur ces informations.
Sois concis mais informatif. Réponds en français.`;

        return await sendToAI(synthesisPrompt);
    }

    /**
     * Génère un message d'échec après avoir visité le maximum de sites
     */
    async generateFailureMessage(
        query: string,
        sitesVisited: number,
        partialInfo: string[],
        sendToAI: (prompt: string) => Promise<string>
    ): Promise<string> {
        console.log(`[CONTENT_ANALYZER] Génération du message d'échec après ${sitesVisited} sites`);

        let partialContext = '';
        if (partialInfo.length > 0) {
            partialContext = `\nINFORMATIONS PARTIELLES TROUVÉES:\n${partialInfo.join('\n')}\n`;
        }

        const failurePrompt = `RECHERCHE INFRUCTUEUSE

QUESTION: "${query}"

SITES VISITÉS: ${sitesVisited}
${partialContext}
---
Explique que malgré la consultation de ${sitesVisited} sites différents, aucune réponse fiable n'a été trouvée.
Si des informations partielles existent, mentionne-les avec prudence.
Suggère des pistes alternatives pour trouver l'information.
Réponds en français.`;

        return await sendToAI(failurePrompt);
    }
}

export const contentAnalyzer = new ContentAnalyzer();
