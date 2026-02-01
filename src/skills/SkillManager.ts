import { SkillBase, SkillExecutionResult } from "./base/SkillBase";
import { Context, NarrowedContext } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";

// Import des skills disponibles
import { CronSkill } from "./implementations/CronSkill";
import { WebSearchSkill } from "./implementations/WebSearchSkill";
import { SystemInfoSkill } from "./implementations/SystemInfoSkill";

/**
 * Interface pour l'enregistrement des skills
 */
export interface SkillRegistration {
    skill: SkillBase;
    enabled: boolean;
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
        this.registerSkill(new SystemInfoSkill()); // Activé pour démonstration
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
     * Traite la détection de skills et exécute le skill approprié
     * @param skillDetection La réponse de détection des skills de l'IA
     * @param ctx Le contexte Telegram
     * @param userId L'ID de l'utilisateur
     * @returns Le résultat d'exécution du skill ou null si aucun skill détecté
     */
    public async processSkillDetection(
        skillDetection: string,
        ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>,
        userId: string
    ): Promise<SkillExecutionResult | null> {
        // Vérifier si aucun skill n'est nécessaire
        if (skillDetection.includes('[NO_SKILL]')) {
            return null;
        }

        console.log(`[SKILL_MANAGER] Traitement de la détection: ${skillDetection}`);

        // Parcourir tous les skills activés pour trouver une correspondance
        let resultPromise: Promise<SkillExecutionResult | null> = Promise.resolve(null);
        
        this.skills.forEach((registration) => {
            if (!registration.enabled) {
                return;
            }

            const skill = registration.skill;
            const detection = skill.detectSkill(skillDetection);

            if (detection.isDetected && resultPromise) {
                console.log(`[SKILL_MANAGER] Skill '${skill.name}' détecté, exécution...`);
                
                resultPromise = (async () => {
                    try {
                        const result = await skill.execute(detection.data!, ctx, userId);
                        
                        if (result.success) {
                            console.log(`[SKILL_MANAGER] Skill '${skill.name}' exécuté avec succès`);
                        } else {
                            console.error(`[SKILL_MANAGER] Échec de l'exécution du skill '${skill.name}':`, result.error);
                        }
                        
                        return result;
                    } catch (error) {
                        console.error(`[SKILL_MANAGER] Erreur lors de l'exécution du skill '${skill.name}':`, error);
                        return {
                            success: false,
                            error: `Erreur lors de l'exécution du skill ${skill.name}`
                        };
                    }
                })();
            }
        });

        const result = await resultPromise;
        if (!result) {
            console.log(`[SKILL_MANAGER] Aucun skill correspondant trouvé pour: ${skillDetection}`);
        }
        
        return result;
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