import { sendMessageToAI } from './ai_bridge';
import { 
    iterativeSearchEngine, 
    WebSearchResult, 
    SourceInfo,
    SearchProgress,
    SearchConfig,
    DEFAULT_SEARCH_CONFIG
} from './web_search';

/**
 * Interface de réponse pour la compatibilité avec l'ancien système
 */
export interface WebSearchResponse {
    query: string;
    results: { title: string; link: string; snippet: string }[];
    summary: string;
}

/**
 * Callback pour les mises à jour de progression
 */
export type WebSearchProgressCallback = (message: string, sitesVisited: number, maxSites: number) => void;

/**
 * Bridge de recherche web amélioré
 * Utilise une recherche itérative qui visite les sites jusqu'à trouver une réponse fiable
 */
export class WebSearchBridge {
    private config: SearchConfig;

    constructor(config: Partial<SearchConfig> = {}) {
        this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
    }

    /**
     * Effectue une recherche web complète avec visite des sites
     * @param query La question de l'utilisateur
     * @param onProgress Callback optionnel pour les mises à jour de progression
     */
    async performWebSearch(
        query: string, 
        onProgress?: WebSearchProgressCallback
    ): Promise<WebSearchResponse> {
        console.log(`[WEB_SEARCH_BRIDGE] Démarrage de la recherche pour: "${query}"`);

        try {
            // Étape 1: Recherche sur DuckDuckGo
            onProgress?.('🔍 Recherche sur DuckDuckGo...', 0, this.config.maxSites);
            const searchResults = await iterativeSearchEngine.searchDuckDuckGo(query);

            if (searchResults.length === 0) {
                console.log('[WEB_SEARCH_BRIDGE] Aucun résultat DuckDuckGo, réponse de fallback');
                return this.generateFallbackResponse(query);
            }

            // Étape 2: Recherche itérative dans les sites
            const progressCallback = (progress: SearchProgress) => {
                onProgress?.(
                    `📖 Analyse du site: ${progress.currentSite}`,
                    progress.sitesVisited,
                    progress.maxSites
                );
            };

            const result = await iterativeSearchEngine.performIterativeSearch(
                query,
                searchResults,
                sendMessageToAI,
                progressCallback
            );

            // Convertir le résultat au format attendu
            return this.convertToWebSearchResponse(result);

        } catch (error) {
            console.error('[WEB_SEARCH_BRIDGE] Erreur lors de la recherche:', error);
            return this.generateErrorResponse(query, error);
        }
    }

    /**
     * Convertit le résultat de recherche itérative au format de réponse attendu
     */
    private convertToWebSearchResponse(result: WebSearchResult): WebSearchResponse {
        return {
            query: result.query,
            results: result.sources.map(source => ({
                title: source.title,
                link: source.url,
                snippet: source.extractedInfo || ''
            })),
            summary: result.answer
        };
    }

    /**
     * Génère une réponse de fallback quand aucun résultat n'est trouvé
     */
    private async generateFallbackResponse(query: string): Promise<WebSearchResponse> {
        const fallbackAnswer = await sendMessageToAI(
            `L'utilisateur demande: "${query}"\n\n` +
            `Aucun résultat de recherche web n'a été trouvé.\n` +
            `Réponds avec tes connaissances générales en précisant que les infos peuvent ne pas être à jour.`
        );

        return {
            query,
            results: [],
            summary: `ℹ️ **Aucun résultat web disponible**\n\n${fallbackAnswer}\n\n---\n*Réponse basée sur les connaissances générales.*`
        };
    }

    /**
     * Génère une réponse en cas d'erreur
     */
    private async generateErrorResponse(query: string, error: unknown): Promise<WebSearchResponse> {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        
        try {
            const fallbackAnswer = await sendMessageToAI(
                `L'utilisateur demande: "${query}"\n\n` +
                `Le système de recherche web rencontre des difficultés.\n` +
                `Réponds du mieux possible avec tes connaissances en étant transparent sur les limitations.`
            );

            return {
                query,
                results: [],
                summary: `⚠️ **Recherche web perturbée**\n\n${fallbackAnswer}\n\n---\n*Erreur technique: ${errorMessage}*`
            };
        } catch {
            return {
                query,
                results: [],
                summary: `❌ Le service de recherche est temporairement indisponible. Erreur: ${errorMessage}`
            };
        }
    }

    /**
     * Ferme le navigateur
     */
    async closeBrowser(): Promise<void> {
        await iterativeSearchEngine.closeBrowser();
    }
}

// Instance singleton
export const webSearchBridge = new WebSearchBridge();

// Nettoyage automatique
process.on('exit', async () => {
    await webSearchBridge.closeBrowser();
});

process.on('SIGINT', async () => {
    await webSearchBridge.closeBrowser();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await webSearchBridge.closeBrowser();
    process.exit(0);
});