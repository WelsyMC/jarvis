import { ContentAnalysis, PageContent } from './types';

/**
 * Module d'analyse de contenu
 * Responsabilité: Demander à l'IA d'évaluer si un contenu répond à la question
 * 
 * IMPORTANT: Prompts courts et segmentés pour éviter de perdre le contexte de l'IA
 * L'IA doit CITER EXACTEMENT les données, pas les inventer
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
            // IMPORTANT: On demande de CITER EXACTEMENT, pas d'interpréter
            const analysisPrompt = `EXTRACTION DE DONNÉES

QUESTION: "${query}"

TEXTE DU SITE:
${truncatedContent}

---
RÈGLES STRICTES:
- CITE EXACTEMENT les chiffres/données du texte, ne les invente pas
- Si tu ne trouves pas la donnée exacte dans le texte, écris "NON TROUVÉ"
- Copie-colle la phrase exacte qui contient la réponse

RÉPONDS DANS CE FORMAT:
TROUVÉ: [OUI/NON]
DONNÉE EXACTE: [Copie la phrase exacte du texte qui répond à la question, ou "Aucune"]
VALEUR: [Le chiffre/donnée extrait, ou "Inconnu"]`;

            const aiResponse = await sendToAI(analysisPrompt);
            console.log(`[CONTENT_ANALYZER] Réponse IA: ${aiResponse.substring(0, 200)}...`);
            
            // Parser la réponse de l'IA
            const analysis = this.parseAnalysisResponse(aiResponse, truncatedContent);
            
            // Validation: vérifier que la donnée citée existe vraiment dans le contenu
            if (analysis.isRelevant && analysis.extractedInfo) {
                const isValid = this.validateExtractedData(analysis.extractedInfo, truncatedContent);
                if (!isValid) {
                    console.log(`[CONTENT_ANALYZER] ⚠️ Donnée non validée dans le contenu source`);
                    analysis.confidence = 'low';
                }
            }
            
            return analysis;

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
     * Valide que les données extraites existent vraiment dans le contenu source
     */
    private validateExtractedData(extractedInfo: string, sourceContent: string): boolean {
        // Extraire les nombres de l'info extraite
        const numbersInExtracted = extractedInfo.match(/\d+[,.]?\d*/g) || [];
        
        if (numbersInExtracted.length === 0) {
            return true; // Pas de nombres à valider
        }

        // Vérifier qu'au moins un nombre significatif existe dans la source
        for (const num of numbersInExtracted) {
            // Normaliser le nombre (remplacer virgule par point)
            const normalizedNum = num.replace(',', '.');
            const numValue = parseFloat(normalizedNum);
            
            // Ignorer les petits nombres (1, 2, etc.) qui sont trop communs
            if (numValue < 10 && !num.includes(',') && !num.includes('.')) {
                continue;
            }

            // Chercher ce nombre dans la source (avec variantes)
            const variations = [
                num,
                num.replace(',', '.'),
                num.replace('.', ','),
            ];
            
            const foundInSource = variations.some(v => sourceContent.includes(v));
            if (foundInSource) {
                console.log(`[CONTENT_ANALYZER] ✓ Nombre "${num}" trouvé dans la source`);
                return true;
            }
        }

        console.log(`[CONTENT_ANALYZER] ✗ Nombres non trouvés dans la source: ${numbersInExtracted.join(', ')}`);
        return false;
    }

    /**
     * Parse la réponse de l'IA pour extraire les informations structurées
     */
    private parseAnalysisResponse(response: string, sourceContent: string): ContentAnalysis {
        const upperResponse = response.toUpperCase();
        
        // Déterminer si trouvé
        const isRelevant = upperResponse.includes('TROUVÉ: OUI') || 
                          upperResponse.includes('TROUVÉ:OUI') ||
                          (upperResponse.includes('TROUVÉ') && !upperResponse.includes('NON TROUVÉ') && upperResponse.includes('OUI'));

        // Extraire la donnée exacte citée
        let extractedInfo = '';
        const dataMatch = response.match(/DONNÉE EXACTE:\s*(.+?)(?=\nVALEUR:|$)/is);
        if (dataMatch && dataMatch[1].trim().toLowerCase() !== 'aucune') {
            extractedInfo = dataMatch[1].trim();
        }

        // Extraire la valeur
        let value = '';
        const valueMatch = response.match(/VALEUR:\s*(.+?)$/is);
        if (valueMatch && valueMatch[1].trim().toLowerCase() !== 'inconnu') {
            value = valueMatch[1].trim();
            // Ajouter la valeur à l'info si elle n'y est pas déjà
            if (value && !extractedInfo.includes(value)) {
                extractedInfo = extractedInfo ? `${extractedInfo} (${value})` : value;
            }
        }

        // Déterminer la confiance basée sur la qualité de l'extraction
        let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
        if (isRelevant && extractedInfo && extractedInfo.length > 10) {
            confidence = 'high';
        } else if (isRelevant && extractedInfo) {
            confidence = 'medium';
        } else if (isRelevant) {
            confidence = 'low';
        }

        console.log(`[CONTENT_ANALYZER] Résultat: pertinent=${isRelevant}, confiance=${confidence}`);

        return {
            isRelevant,
            confidence,
            extractedInfo,
            reason: isRelevant ? 'Donnée trouvée dans le contenu' : 'Donnée non trouvée'
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

DONNÉES EXTRAITES DES SITES:
${infoContext}

---
RÈGLES:
- Utilise UNIQUEMENT les données ci-dessus
- Ne modifie pas les chiffres, cite-les exactement
- Sois concis et direct

Réponds à la question en français:`;

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
