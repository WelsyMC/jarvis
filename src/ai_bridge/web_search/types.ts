/**
 * Types et interfaces pour le système de recherche web amélioré
 */

/**
 * Résultat d'une recherche sur un moteur de recherche (lien trouvé)
 */
export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
}

/**
 * Contenu extrait d'une page web
 */
export interface PageContent {
    url: string;
    title: string;
    content: string;
    extractedAt: Date;
    success: boolean;
    error?: string;
}

/**
 * Analyse de la pertinence d'un contenu par rapport à une question
 */
export interface ContentAnalysis {
    isRelevant: boolean;
    confidence: 'high' | 'medium' | 'low' | 'none';
    extractedInfo: string;
    reason: string;
}

/**
 * État d'avancement de la recherche itérative
 */
export interface SearchProgress {
    sitesVisited: number;
    maxSites: number;
    currentSite: string;
    sitesWithContent: string[];
    foundReliableAnswer: boolean;
}

/**
 * Callback pour les mises à jour de progression
 */
export type ProgressCallback = (progress: SearchProgress) => void;

/**
 * Résultat final de la recherche web améliorée
 */
export interface WebSearchResult {
    query: string;
    answer: string;
    sources: SourceInfo[];
    searchComplete: boolean;
    sitesVisited: number;
    foundReliableAnswer: boolean;
}

/**
 * Information sur une source utilisée
 */
export interface SourceInfo {
    url: string;
    title: string;
    wasUseful: boolean;
    extractedInfo?: string;
}

/**
 * Configuration de la recherche
 */
export interface SearchConfig {
    maxSites: number;          // Nombre max de sites à visiter (défaut: 10)
    minConfidence: 'high' | 'medium' | 'low';  // Niveau de confiance minimum accepté
    timeoutPerPage: number;    // Timeout par page en ms (défaut: 15000)
    delayBetweenPages: number; // Délai entre les pages en ms (défaut: 1000)
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
    maxSites: 10,
    minConfidence: 'medium',
    timeoutPerPage: 15000,
    delayBetweenPages: 1000
};
