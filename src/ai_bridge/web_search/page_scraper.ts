import { Page } from 'puppeteer';
import { PageContent } from './types';

/**
 * Module de scraping de pages web
 * Responsabilité: Extraire le contenu textuel pertinent d'une page web
 */
export class PageScraper {
    
    /**
     * Extrait le contenu principal d'une page web
     * @param page Instance Puppeteer de la page
     * @param url URL de la page
     * @param timeout Timeout en ms
     */
    async extractPageContent(page: Page, url: string, timeout: number = 15000): Promise<PageContent> {
        try {
            console.log(`[PAGE_SCRAPER] Navigation vers: ${url}`);
            
            // Navigation vers la page avec timeout
            await page.goto(url, { 
                waitUntil: 'domcontentloaded', 
                timeout: timeout 
            });

            // Attendre un peu que le contenu se charge
            await this.delay(2000);

            // Extraire le contenu de la page
            const extractedData = await page.evaluate(() => {
                // Supprimer les éléments non pertinents
                const selectorsToRemove = [
                    'script', 'style', 'nav', 'header', 'footer', 
                    'aside', 'iframe', 'noscript', '.ads', '.advertisement',
                    '.cookie-banner', '.popup', '.modal', '.sidebar',
                    '[role="navigation"]', '[role="banner"]', '[role="complementary"]'
                ];
                
                selectorsToRemove.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });

                // Chercher le contenu principal
                const mainContentSelectors = [
                    'main',
                    'article',
                    '[role="main"]',
                    '.content',
                    '.post-content',
                    '.article-content',
                    '.entry-content',
                    '#content',
                    '.main-content'
                ];

                let mainContent: Element | null = null;
                for (const selector of mainContentSelectors) {
                    mainContent = document.querySelector(selector);
                    if (mainContent && mainContent.textContent && mainContent.textContent.trim().length > 200) {
                        break;
                    }
                }

                // Fallback: prendre le body si pas de contenu principal identifié
                if (!mainContent) {
                    mainContent = document.body;
                }

                // Extraire le texte de manière propre
                const textContent = mainContent?.textContent || '';
                
                // Nettoyer le texte
                const cleanedText = textContent
                    .replace(/\s+/g, ' ')           // Normaliser les espaces
                    .replace(/\n\s*\n/g, '\n')      // Supprimer les lignes vides multiples
                    .trim();

                // Récupérer le titre
                const title = document.title || 
                    document.querySelector('h1')?.textContent || 
                    'Sans titre';

                return {
                    title: title.trim(),
                    content: cleanedText.substring(0, 8000) // Limiter à 8000 caractères pour le contexte IA
                };
            });

            console.log(`[PAGE_SCRAPER] Contenu extrait: ${extractedData.content.length} caractères`);

            return {
                url,
                title: extractedData.title,
                content: extractedData.content,
                extractedAt: new Date(),
                success: true
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
            console.error(`[PAGE_SCRAPER] Erreur lors de l'extraction de ${url}:`, errorMessage);
            
            return {
                url,
                title: '',
                content: '',
                extractedAt: new Date(),
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Extrait le contenu de plusieurs pages en séquence
     * @param page Instance Puppeteer
     * @param urls Liste des URLs à visiter
     * @param delayBetweenPages Délai entre chaque page en ms
     */
    async extractMultiplePages(
        page: Page, 
        urls: string[], 
        delayBetweenPages: number = 1000
    ): Promise<PageContent[]> {
        const results: PageContent[] = [];

        for (const url of urls) {
            const content = await this.extractPageContent(page, url);
            results.push(content);
            
            // Délai entre les pages pour éviter le rate limiting
            if (urls.indexOf(url) < urls.length - 1) {
                await this.delay(delayBetweenPages);
            }
        }

        return results;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const pageScraper = new PageScraper();
