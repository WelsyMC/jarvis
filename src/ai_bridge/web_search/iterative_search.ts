import puppeteer, { Browser, Page } from 'puppeteer';
import { pageScraper } from './page_scraper';
import { contentAnalyzer } from './content_analyzer';
import { 
    SearchResult, 
    WebSearchResult, 
    SourceInfo, 
    SearchConfig, 
    DEFAULT_SEARCH_CONFIG,
    ProgressCallback,
    SearchProgress,
    ContentAnalysis
} from './types';

/**
 * Module de recherche itérative
 * Responsabilité: Orchestrer la recherche en visitant les sites un par un
 * jusqu'à trouver une réponse fiable ou atteindre la limite
 */
export class IterativeSearchEngine {
    private browser: Browser | null = null;
    private config: SearchConfig;

    constructor(config: Partial<SearchConfig> = {}) {
        this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
    }

    /**
     * Effectue une recherche itérative complète
     * @param query La question de l'utilisateur
     * @param searchResults Les résultats de la recherche DuckDuckGo
     * @param sendToAI Fonction pour envoyer des prompts à l'IA
     * @param onProgress Callback pour les mises à jour de progression
     */
    async performIterativeSearch(
        query: string,
        searchResults: SearchResult[],
        sendToAI: (prompt: string) => Promise<string>,
        onProgress?: ProgressCallback
    ): Promise<WebSearchResult> {
        console.log(`[ITERATIVE_SEARCH] Démarrage de la recherche pour: "${query}"`);
        console.log(`[ITERATIVE_SEARCH] ${searchResults.length} résultats à explorer (max ${this.config.maxSites})`);

        const sources: SourceInfo[] = [];
        const collectedInfo: { url: string; info: string }[] = [];
        const partialInfo: string[] = [];
        let foundReliableAnswer = false;
        let sitesVisited = 0;
        let page: Page | null = null;

        try {
            // Initialiser le navigateur
            await this.initBrowser();
            page = await this.browser!.newPage();
            await this.configurePageForScraping(page);

            // Limiter aux sites disponibles
            const sitesToVisit = searchResults.slice(0, this.config.maxSites);

            for (const result of sitesToVisit) {
                sitesVisited++;

                // Notifier la progression
                const progress: SearchProgress = {
                    sitesVisited,
                    maxSites: this.config.maxSites,
                    currentSite: result.title,
                    sitesWithContent: sources.filter(s => s.wasUseful).map(s => s.title),
                    foundReliableAnswer: false
                };
                onProgress?.(progress);

                console.log(`[ITERATIVE_SEARCH] Site ${sitesVisited}/${this.config.maxSites}: ${result.title}`);

                // Extraire le contenu de la page
                const pageContent = await pageScraper.extractPageContent(
                    page, 
                    result.link, 
                    this.config.timeoutPerPage
                );

                if (!pageContent.success || pageContent.content.length < 100) {
                    console.log(`[ITERATIVE_SEARCH] Contenu insuffisant, passage au site suivant`);
                    sources.push({
                        url: result.link,
                        title: result.title,
                        wasUseful: false
                    });
                    continue;
                }

                // Analyser le contenu avec l'IA
                const analysis = await contentAnalyzer.analyzeContent(
                    query,
                    pageContent,
                    sendToAI
                );

                // Enregistrer la source
                sources.push({
                    url: result.link,
                    title: result.title,
                    wasUseful: analysis.isRelevant,
                    extractedInfo: analysis.extractedInfo
                });

                if (analysis.isRelevant && analysis.extractedInfo) {
                    collectedInfo.push({
                        url: result.link,
                        info: analysis.extractedInfo
                    });

                    // Vérifier si on a une réponse suffisamment fiable
                    if (contentAnalyzer.isConfidenceSufficient(analysis, this.config.minConfidence)) {
                        console.log(`[ITERATIVE_SEARCH] Réponse fiable trouvée après ${sitesVisited} sites!`);
                        foundReliableAnswer = true;

                        // Générer la synthèse finale
                        const finalAnswer = await contentAnalyzer.generateFinalSynthesis(
                            query,
                            collectedInfo,
                            sendToAI
                        );

                        return {
                            query,
                            answer: finalAnswer,
                            sources,
                            searchComplete: true,
                            sitesVisited,
                            foundReliableAnswer: true
                        };
                    } else {
                        // Info partielle, on continue à chercher
                        partialInfo.push(analysis.extractedInfo);
                    }
                }

                // Délai entre les pages
                await this.delay(this.config.delayBetweenPages);
            }

            // Si on arrive ici, on n'a pas trouvé de réponse fiable
            console.log(`[ITERATIVE_SEARCH] Aucune réponse fiable après ${sitesVisited} sites`);

            // Si on a des infos partielles, générer une synthèse avec avertissement
            if (collectedInfo.length > 0) {
                const partialAnswer = await contentAnalyzer.generateFinalSynthesis(
                    query,
                    collectedInfo,
                    sendToAI
                );

                return {
                    query,
                    answer: `⚠️ **Résultat partiel** (confiance limitée)\n\n${partialAnswer}\n\n---\n*Cette réponse est basée sur des informations partielles trouvées sur ${sitesVisited} sites.*`,
                    sources,
                    searchComplete: true,
                    sitesVisited,
                    foundReliableAnswer: false
                };
            }

            // Aucune info trouvée du tout
            const failureMessage = await contentAnalyzer.generateFailureMessage(
                query,
                sitesVisited,
                partialInfo,
                sendToAI
            );

            return {
                query,
                answer: `❌ **Recherche infructueuse**\n\n${failureMessage}`,
                sources,
                searchComplete: true,
                sitesVisited,
                foundReliableAnswer: false
            };

        } catch (error) {
            console.error('[ITERATIVE_SEARCH] Erreur lors de la recherche:', error);
            throw error;
        } finally {
            if (page) {
                await page.close().catch(() => {});
            }
        }
    }

    /**
     * Initialise le navigateur Puppeteer
     */
    private async initBrowser(): Promise<void> {
        if (!this.browser) {
            console.log('[ITERATIVE_SEARCH] Lancement de Chrome...');
            this.browser = await puppeteer.launch({
                headless: false,
                devtools: true,
                defaultViewport: null,
                args: [
                    '--start-maximized',
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });
            console.log('[ITERATIVE_SEARCH] Chrome lancé avec succès');
        }
    }

    /**
     * Configure la page pour le scraping
     */
    private async configurePageForScraping(page: Page): Promise<void> {
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        );
        
        // Bloquer les ressources inutiles pour accélérer
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });
    }

    /**
     * Effectue la recherche initiale sur DuckDuckGo
     */
    async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
        let page: Page | null = null;

        try {
            await this.initBrowser();
            page = await this.browser!.newPage();
            
            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
            );

            console.log(`[ITERATIVE_SEARCH] Recherche DuckDuckGo: "${query}"`);
            const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web`;
            await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            await this.delay(3000);

            const results = await this.extractDuckDuckGoResults(page);
            console.log(`[ITERATIVE_SEARCH] ${results.length} résultats trouvés sur DuckDuckGo`);
            
            return results;

        } finally {
            if (page) {
                await page.close().catch(() => {});
            }
        }
    }

    /**
     * Extrait les résultats de DuckDuckGo
     */
    private async extractDuckDuckGoResults(page: Page): Promise<SearchResult[]> {
        return await page.evaluate(() => {
            const results: SearchResult[] = [];
            
            const resultSelectors = [
                '[data-testid="result"]',
                '.results_links',
                '.result',
                '#links .result',
                'article[data-testid="result"]'
            ];

            let resultElements: NodeListOf<Element> | null = null;
            
            for (const selector of resultSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    resultElements = elements;
                    break;
                }
            }

            if (!resultElements) return results;

            for (let i = 0; i < Math.min(resultElements.length, 15); i++) {
                const element = resultElements[i];
                
                try {
                    const titleSelectors = [
                        'h3 a', '.result__title a', '[data-testid="result-title-a"]',
                        'h2 a', 'a[data-testid="result-title-a"]'
                    ];
                    
                    let titleElement = null;
                    let linkElement = null;
                    
                    for (const selector of titleSelectors) {
                        titleElement = element.querySelector(selector);
                        if (titleElement) {
                            linkElement = titleElement;
                            break;
                        }
                    }
                    
                    if (!titleElement) {
                        linkElement = element.querySelector('a[href]');
                        titleElement = linkElement;
                    }
                    
                    const snippetSelectors = [
                        '.result__snippet', '[data-testid="result-snippet"]',
                        '.result__body', '.snippet'
                    ];
                    
                    let snippetElement = null;
                    for (const selector of snippetSelectors) {
                        snippetElement = element.querySelector(selector);
                        if (snippetElement?.textContent?.trim()) break;
                    }

                    if (titleElement && linkElement) {
                        const title = titleElement.textContent?.trim() || '';
                        const link = (linkElement as HTMLAnchorElement).href || '';
                        const snippet = snippetElement?.textContent?.trim() || '';

                        if (title && link.startsWith('http') && !link.includes('duckduckgo.com')) {
                            results.push({
                                title: title.substring(0, 200),
                                link: link,
                                snippet: snippet.substring(0, 400)
                            });
                        }
                    }
                } catch (error) {
                    // Ignorer les erreurs d'extraction individuelles
                }
            }

            return results;
        });
    }

    /**
     * Ferme le navigateur
     */
    async closeBrowser(): Promise<void> {
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                console.log('[ITERATIVE_SEARCH] Navigateur fermé');
            } catch (error) {
                console.error('[ITERATIVE_SEARCH] Erreur fermeture navigateur:', error);
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const iterativeSearchEngine = new IterativeSearchEngine();
