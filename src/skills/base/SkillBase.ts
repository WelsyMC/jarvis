import { Context, NarrowedContext } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";

/**
 * Interface pour envoyer des messages à l'utilisateur
 */
export interface IMessageSender {
    sendMessage(userId: string, message: string, parseMode?: 'MarkdownV2' | 'Markdown' | 'HTML'): Promise<void>;
}

/**
 * Interface pour les données parseées d'un skill
 */
export interface SkillData {
    [key: string]: any;
}

/**
 * Interface pour le résultat d'exécution d'un skill
 */
export interface SkillExecutionResult {
    success: boolean;
    message?: string;
    error?: string;
    requiresResponse?: boolean;
    responseData?: any;
}

/**
 * Interface pour la détection de skill
 */
export interface SkillDetectionResult {
    isDetected: boolean;
    data?: SkillData;
}

/**
 * Classe abstraite de base pour tous les skills
 */
export abstract class SkillBase {
    /**
     * Nom unique du skill
     */
    public abstract readonly name: string;

    /**
     * Description du skill
     */
    public abstract readonly description: string;

    /**
     * Détecte si ce skill doit être exécuté basé sur la réponse de détection de l'IA
     * @param skillDetection La réponse complète de détection des skills
     * @returns Résultat de la détection avec les données parseées
     */
    public abstract detectSkill(skillDetection: string): SkillDetectionResult;

    /**
     * Exécute le skill avec les données fournies
     * @param data Les données parseées du skill
     * @param userId L'ID de l'utilisateur
     * @param messageSender Interface pour envoyer des messages
     * @returns Résultat de l'exécution
     */
    public abstract execute(
        data: SkillData,
        userId: string,
        messageSender: IMessageSender
    ): Promise<SkillExecutionResult>;

    /**
     * Formate un message pour l'affichage (optionnel)
     * @param data Les données à formater
     * @returns Message formaté
     */
    public formatMessage?(data: any): string;

    /**
     * Valide les données du skill (optionnel)
     * @param data Les données à valider
     * @returns True si valide, false sinon
     */
    public validateData?(data: SkillData): boolean;
}