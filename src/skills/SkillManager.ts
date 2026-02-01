import { SkillBase, SkillExecutionResult, SkillData, IMessageSender } from "@base/SkillBase";
import { Context, NarrowedContext } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";

// Import des skills disponibles
import { CronSkill } from "./implementations/CronSkill";
import { WebSearchSkill } from "./implementations/web/WebSearchSkill";
import { SystemInfoSkill } from "./implementations/SystemInfoSkill";
import { CalculatorSkill } from "./implementations/CalculatorSkill";
import { GoogleGmailSkill } from "./implementations/google/skills/GoogleGmailSkill";
import { GoogleSkillModule } from "./implementations/google/GoogleSkillModule";

/**
 * Interface pour l'enregistrement des skills
 */
export interface SkillRegistration {
    skill: SkillBase;
    enabled: boolean;
}

/**
 * Interface pour un skill détecté avec ses données
 */
export interface DetectedSkill {
    skill: SkillBase;
    data: SkillData;
    skillName: string;
}

/**
 * Interface pour les résultats d'exécution de plusieurs skills
 */
export interface MultiSkillExecutionResult {
    results: Array<SkillExecutionResult & { skillName: string }>;
    combinedMessage: string;
    allSuccessful: boolean;
}

/**
 * Gestionnaire centralisé des skills
 */
export class SkillManager {
    private skills: Map<string, SkillRegistration> = new Map();

    constructor() {
        this.registerDefaultSkills();
    }

    /**
     * Enregistre les skills par défaut
     */
    private registerDefaultSkills() {
        this.registerSkill(new CronSkill());
        this.registerSkill(new WebSearchSkill());
        this.registerSkill(new SystemInfoSkill());

        GoogleSkillModule.init().forEach(skill => {
            this.registerSkill(skill);
        });
        
        this.registerSkill(new CalculatorSkill()); // Activé pour démonstration
    }

    /**
     * Enregistre un nouveau skill
     * @param skill Le skill à enregistrer
     * @param enabled Si le skill est activé par défaut (true par défaut)
     */
    public registerSkill(skill: SkillBase, enabled: boolean = true): void {
        if (this.skills.has(skill.name)) {
            console.warn(`[SKILL_MANAGER] Skill '${skill.name}' déjà enregistré, remplacement...`);
        }

        this.skills.set(skill.name, {
            skill: skill,
            enabled: enabled
        });

        console.log(`[SKILL_MANAGER] Skill '${skill.name}' enregistré (${enabled ? 'activé' : 'désactivé'})`);
        this.notifySkillConfigChanged();
    }

    /**
     * Désactive un skill
     * @param skillName Le nom du skill à désactiver
     */
    public disableSkill(skillName: string): boolean {
        const registration = this.skills.get(skillName);
        if (registration) {
            registration.enabled = false;
            console.log(`[SKILL_MANAGER] Skill '${skillName}' désactivé`);
            this.notifySkillConfigChanged();
            return true;
        }
        return false;
    }

    /**
     * Active un skill
     * @param skillName Le nom du skill à activer
     */
    public enableSkill(skillName: string): boolean {
        const registration = this.skills.get(skillName);
        if (registration) {
            registration.enabled = true;
            console.log(`[SKILL_MANAGER] Skill '${skillName}' activé`);
            this.notifySkillConfigChanged();
            return true;
        }
        return false;
    }

    /**
     * Récupère la liste des skills enregistrés
     * @param onlyEnabled Si true, ne retourne que les skills activés
     */
    public getSkills(onlyEnabled: boolean = false): SkillBase[] {
        const results: SkillBase[] = [];
        
        this.skills.forEach((registration) => {
            if (!onlyEnabled || registration.enabled) {
                results.push(registration.skill);
            }
        });
        
        return results;
    }

    /**
     * Récupère un skill par son nom
     * @param skillName Le nom du skill
     * @returns Le skill ou undefined si non trouvé
     */
    public getSkill(skillName: string): SkillBase | undefined {
        const registration = this.skills.get(skillName);
        return registration?.enabled ? registration.skill : undefined;
    }

    /**
     * Détecte tous les skills présents dans la réponse de l'IA
     * @param skillDetection La réponse de détection des skills de l'IA
     * @returns Liste des skills détectés avec leurs données
     */
    public detectAllSkills(skillDetection: string): DetectedSkill[] {
        const detectedSkills: DetectedSkill[] = [];
        
        if (skillDetection.includes('[NO_SKILL]')) {
            return detectedSkills;
        }

        this.skills.forEach((registration) => {
            if (!registration.enabled) {
                return;
            }

            const skill = registration.skill;
            const detection = skill.detectSkill(skillDetection);

            if (detection.isDetected) {
                console.log(`[SKILL_MANAGER] Skill '${skill.name}' détecté`);
                detectedSkills.push({
                    skill: skill,
                    data: detection.data!,
                    skillName: skill.name
                });
            }
        });

        return detectedSkills;
    }

    /**
     * Exécute plusieurs skills en séquence
     * @param detectedSkills Liste des skills à exécuter
     * @param messageSender Interface pour envoyer des messages
     * @param userId L'ID de l'utilisateur
     * @returns Résultat combiné de tous les skills
     */
    public async executeMultipleSkills(
        detectedSkills: DetectedSkill[],
        messageSender: IMessageSender | null,
        userId: string
    ): Promise<MultiSkillExecutionResult> {
        const results: Array<SkillExecutionResult & { skillName: string }> = [];
        let combinedMessage = '';
        let allSuccessful = true;

        for (const detected of detectedSkills) {
            console.log(`[SKILL_MANAGER] Exécution du skill '${detected.skillName}'...`);
            
            // Skip if messageSender is null - some skills require message sending capability
            if (!messageSender) {
                console.warn(`[SKILL_MANAGER] Skill '${detected.skillName}' ne peut pas être exécuté sans capacité d'envoi de messages`);
                results.push({
                    success: false,
                    error: `Le skill ${detected.skillName} nécessite une capacité d'envoi de messages valide`,
                    skillName: detected.skillName
                });
                allSuccessful = false;
                continue;
            }
            
            try {
                const result = await detected.skill.execute(detected.data, userId, messageSender);
                results.push({ ...result, skillName: detected.skillName });

                if (result.success) {
                    console.log(`[SKILL_MANAGER] Skill '${detected.skillName}' exécuté avec succès`);
                    if (result.message) {
                        combinedMessage += (combinedMessage ? '\n\n' : '') + result.message;
                    }
                } else {
                    console.error(`[SKILL_MANAGER] Échec du skill '${detected.skillName}':`, result.error);
                    allSuccessful = false;
                }
            } catch (error) {
                console.error(`[SKILL_MANAGER] Erreur lors de l'exécution du skill '${detected.skillName}':`, error);
                results.push({
                    success: false,
                    error: `Erreur lors de l'exécution du skill ${detected.skillName}`,
                    skillName: detected.skillName
                });
                allSuccessful = false;
            }
        }

        return {
            results,
            combinedMessage,
            allSuccessful
        };
    }

    /**
     * Traite la détection de skills et exécute les skills appropriés (multi-skills)
     * @param skillDetection La réponse de détection des skills de l'IA
     * @param messageSender Interface pour envoyer des messages
     * @param userId L'ID de l'utilisateur
     * @returns Le résultat d'exécution des skills ou null si aucun skill détecté
     */
    public async processSkillDetection(
        skillDetection: string,
        messageSender: IMessageSender | null,
        userId: string
    ): Promise<SkillExecutionResult | null> {
        const detectedSkills = this.detectAllSkills(skillDetection);
        
        if (detectedSkills.length === 0) {
            console.log(`[SKILL_MANAGER] Aucun skill détecté`);
            return null;
        }

        console.log(`[SKILL_MANAGER] ${detectedSkills.length} skill(s) détecté(s): ${detectedSkills.map(s => s.skillName).join(', ')}`);

        // Exécuter tous les skills en séquence
        const multiResult = await this.executeMultipleSkills(detectedSkills, messageSender, userId);

        // Retourner un résultat combiné
        if (multiResult.results.length === 1) {
            return multiResult.results[0];
        }

        return {
            success: multiResult.allSuccessful,
            message: multiResult.combinedMessage,
            requiresResponse: true,
            responseData: {
                multiSkill: true,
                skillNames: detectedSkills.map(s => s.skillName),
                results: multiResult.results
            }
        };
    }

    /**
     * Exécute un prompt avec détection et exécution de skills (pour le cron)
     * Supporte le chaînage des skills avec passage de contexte
     * Ne nécessite pas de contexte Telegram
     * @param prompt Le prompt à traiter
     * @param userId L'ID de l'utilisateur
     * @returns Le message de réponse combiné
     */
    public async executePromptWithSkills(
        prompt: string,
        userId: string
    ): Promise<{ response: string; skillsUsed: string[] }> {
        // Import dynamique pour éviter les dépendances circulaires
        const { detectSkills, sendMessageToAI } = await import('../ai_bridge/ai_bridge');
        const { cronMessageSender } = await import('../ai_bridge/message_sender');
        
        console.log(`[SKILL_MANAGER] Exécution du prompt avec skills: "${prompt}"`);
        
        // Étape 1: Détecter les skills nécessaires
        const skillDetection = await detectSkills(prompt);
        console.log(`[SKILL_MANAGER] Détection: ${skillDetection}`);

        const detectedSkills = this.detectAllSkills(skillDetection);
        
        if (detectedSkills.length === 0) {
            // Aucun skill nécessaire, utiliser l'IA directement
            console.log(`[SKILL_MANAGER] Aucun skill détecté, utilisation de l'IA directement`);
            const aiResponse = await sendMessageToAI(prompt);
            return { response: aiResponse, skillsUsed: [] };
        }

        console.log(`[SKILL_MANAGER] Skills détectés pour cron: ${detectedSkills.map(s => s.skillName).join(', ')}`);

        // Étape 2: Exécuter les skills en chaîne avec passage de contexte
        const allSkillsUsed: string[] = [];
        let accumulatedContext = '';
        
        for (const detected of detectedSkills) {
            console.log(`[SKILL_MANAGER] Exécution du skill '${detected.skillName}' en chaîne...`);
            allSkillsUsed.push(detected.skillName);
            
            try {
                const result = await detected.skill.execute(detected.data, userId, cronMessageSender);
                
                if (result.success) {
                    console.log(`[SKILL_MANAGER] Skill '${detected.skillName}' exécuté avec succès`);
                    if (result.message) {
                        // Accumuler le contexte des résultats précédents
                        accumulatedContext += (accumulatedContext ? '\n\n' : '') + `[${detected.skillName}]: ${result.message}`;
                    }
                } else {
                    console.error(`[SKILL_MANAGER] Échec du skill '${detected.skillName}':`, result.error);
                    accumulatedContext += (accumulatedContext ? '\n\n' : '') + `[${detected.skillName}] ERREUR: ${result.error}`;
                }
            } catch (error) {
                console.error(`[SKILL_MANAGER] Erreur lors de l'exécution du skill '${detected.skillName}':`, error);
                accumulatedContext += (accumulatedContext ? '\n\n' : '') + `[${detected.skillName}] ERREUR: ${error}`;
            }
        }
        
        if (!accumulatedContext) {
            return {
                response: "La tâche a été exécutée.",
                skillsUsed: allSkillsUsed
            };
        }

        // Étape 3: Demander à l'IA de formuler une réponse avec tout le contexte accumulé
        const finalPrompt = `L'utilisateur avait demandé: "${prompt}"

Voici les informations récupérées:
${accumulatedContext}

Réponds à l'utilisateur de manière naturelle et concise avec ces informations.`;
        
        const finalResponse = await sendMessageToAI(finalPrompt);
        return {
            response: finalResponse,
            skillsUsed: allSkillsUsed
        };
    }

    /**
     * Récupère des informations sur tous les skills
     */
    public getSkillsInfo(): Array<{name: string, description: string, enabled: boolean}> {
        const infos: Array<{name: string, description: string, enabled: boolean}> = [];
        
        this.skills.forEach((registration) => {
            infos.push({
                name: registration.skill.name,
                description: registration.skill.description,
                enabled: registration.enabled
            });
        });
        
        return infos;
    }

    /**
     * Notifie que la configuration des skills a changé
     * Cela permet aux autres systèmes de se mettre à jour
     */
    private notifySkillConfigChanged(): void {
        // Émettre un événement pour notifier les changements
        // Cela permettra au SystemPromptManager de se mettre à jour
        console.log(`[SKILL_MANAGER] Configuration des skills mise à jour. Skills actifs: ${this.getSkills(true).map(s => s.name).join(', ')}`);
    }
}

// Instance singleton du gestionnaire de skills
export const skillManager = new SkillManager();