import { skillManager } from '../skills';

export class SystemPromptManager {
    private systemPrompt: string;

    constructor() {
        this.systemPrompt = this.getDefaultSystemPrompt();
    }

    /**
     * Prompt pour la détection des skills (premier appel IA)
     * Génère dynamiquement la liste des skills disponibles
     */
    public getSkillDetectionPrompt(): string {
        const skillsInfo = skillManager.getSkillsInfo();
        const activeSkills = skillsInfo.filter(skill => skill.enabled);
        
        let skillsSection = '';
        let examplesSection = '';
        
        if (activeSkills.length > 0) {
            skillsSection = 'SKILLS DISPONIBLES:\n\n';
            
            activeSkills.forEach((skillInfo, index) => {
                skillsSection += `${index + 1}. '${skillInfo.name}' : ${skillInfo.description}\n`;
                
                // Ajouter des exemples spécifiques pour les skills connus
                if (skillInfo.name === 'cron') {
                    skillsSection += `   - Mots-clés: "dans X secondes/minutes/heures", "rappelle-moi", "dis-moi dans", etc.
   - Format de sortie:
     [SKILL: cron]
     Prompt: "message à envoyer plus tard"
     Délai: Xs/Xm/Xh
   
   Exemples:
   User: "Dis moi bonjour dans 10 secondes"
   → [SKILL: cron]
      Prompt: "Bonjour !"
      Délai: 10s
     
   User: "Rappelle-moi de faire les courses dans 2 heures"
   → [SKILL: cron]
      Prompt: "N'oublie pas de faire les courses !"
      Délai: 2h\n\n`;
      
                } else if (skillInfo.name === 'web_search') {
                    skillsSection += `   - Questions nécessitant des données récentes, météo, actualités, infos spécifiques, sport, résultats sportifs
   - Mots-clés/contextes: "quelle est la température", "météo", "actualités", "prix de", "cours de", "dernières news", "qu'est-ce qui se passe", "cherche", "trouve-moi", "qui a marqué", "qui a mis le but", "score", "résultat", "match", "finale", "coupe", "championnat", etc.
   - Format de sortie:
     [SKILL: web_search]
     Query: "requête de recherche optimisée"
   
   Exemples:
   User: "Quelle est la température à Paris?" 
   → [SKILL: web_search]
      Query: "température météo Paris aujourd'hui"
   
   User: "Cherche les dernières news sur l'IA"
   → [SKILL: web_search] 
      Query: "dernières actualités intelligence artificielle"
   
   User: "Qu'est-ce qui se passe en Ukraine?"
   → [SKILL: web_search]
      Query: "actualités Ukraine récentes"
      
   User: "Quel est le prix du Bitcoin?"
   → [SKILL: web_search]
      Query: "prix Bitcoin cours actuel"
      
   User: "Qui a mis le but pour la finale de la coupe d'afrique nations 2026 ?"
   → [SKILL: web_search]
      Query: "buteur finale coupe afrique nations 2026 qui a marqué"
      
   User: "Quel est le score du match de foot hier ?"
   → [SKILL: web_search]
      Query: "résultat score match football hier"\n\n`;
      
                } else if (skillInfo.name === 'system_info') {
                    skillsSection += `   - Demandes d'informations système (heure, date, mémoire, etc.)
   - Format de sortie:
     [SKILL: system_info]
     Type: "time|date|uptime|memory|all"
   
   Exemples:
   User: "Quelle heure est-il?"
   → [SKILL: system_info]
      Type: "time"
   
   User: "Infos système"
   → [SKILL: system_info]
      Type: "all"\n\n`;
      
                } else if (skillInfo.name === 'calculator') {
                    skillsSection += `   - Calculs mathématiques et évaluations d'expressions
   - Format de sortie:
     [SKILL: calculator]
     Expression: "expression mathématique"
   
   Exemples:
   User: "Calcule 15 + 25 * 2"
   → [SKILL: calculator]
      Expression: "15 + 25 * 2"
   
   User: "Combien font 10 fois 7?"
   → [SKILL: calculator]
      Expression: "10 * 7"\n\n`;
      
                } else {
                    // Skill générique - format basique
                    skillsSection += `   - Format de sortie:
     [SKILL: ${skillInfo.name}]
     (paramètres spécifiques au skill)\n\n`;
                }
            });
            
            // Générer des exemples globaux
            examplesSection = `
        Exemples globaux:
        User: "Salut" → [NO_SKILL]
        User: "Comment vas-tu?" → [NO_SKILL]
        User: "Il fait beau" → [NO_SKILL]`;
        
            if (activeSkills.find(s => s.name === 'web_search')) {
                examplesSection += `
        User: "Quelle est la température à Toulouse?" → [SKILL: web_search] Query: "température météo Toulouse aujourd'hui"
        User: "Cherche les dernières news sur l'IA" → [SKILL: web_search] Query: "dernières actualités intelligence artificielle"
        User: "Qui a mis le but pour la finale de la coupe afrique nations 2026 ?" → [SKILL: web_search] Query: "buteur finale coupe afrique nations 2026 qui a marqué"
        User: "Quel est le score du PSG hier ?" → [SKILL: web_search] Query: "résultat score PSG match hier"`;
            }
            
            if (activeSkills.find(s => s.name === 'cron')) {
                examplesSection += `
        User: "Rappelle-moi dans 5 minutes" → [SKILL: cron] Prompt: "Rappel !" Délai: 5m`;
            }
            
            if (activeSkills.find(s => s.name === 'system_info')) {
                examplesSection += `
        User: "Quelle heure est-il?" → [SKILL: system_info] Type: "time"`;
            }
            
            if (activeSkills.find(s => s.name === 'calculator')) {
                examplesSection += `
        User: "Combien font 2 + 2?" → [SKILL: calculator] Expression: "2 + 2"`;
            }
        } else {
            skillsSection = 'AUCUN SKILL DISPONIBLE - Toutes les demandes devraient retourner [NO_SKILL]\n\n';
            examplesSection = `
        Exemples:
        User: "Salut" → [NO_SKILL]
        User: "Comment vas-tu?" → [NO_SKILL]
        User: "Quelle est la météo?" → [NO_SKILL]`;
        }

        return `
        Tu es un système de détection de skills. Analyse la demande de l'utilisateur et détermine quels skills utiliser.

        ${skillsSection}
        
        RÈGLES:
        - Si AUCUN skill n'est nécessaire, réponds UNIQUEMENT: [NO_SKILL]
        - Ne réponds PAS à la question de l'utilisateur, détecte juste les skills
        - Pour une conversation normale, réponds: [NO_SKILL]
        - Questions rhétoriques/conversation = [NO_SKILL]
        - ATTENTION: "Qui a mis le but" = demande de connaître le BUTEUR/GOAL SCORER, pas qui a choisi le stade
        - "Mettre un but" en sport = MARQUER un but, scorer un goal
        - Analyse le contexte sportif correctement: but = goal, pas stade ou infrastructure
        ${examplesSection}
        `;
    }

    private getDefaultSystemPrompt(): string {
        return `
        Tu es un assistant IA. Réponds de manière ultra-brève et naturelle.

        Règles strictes:
        - Salutations: réponds par un simple "Salut!" ou équivalent (max 1-2 mots)
        - Questions simples: réponse directe sans introduction
        - Ne te présente JAMAIS comme assistant IA
        - Ne parle JAMAIS de tes capacités ou limitations
        - Ne fais JAMAIS de meta-commentaires sur comment tu réponds
        - Sois naturel et concis comme un humain

        Exemples:
        User: "Salut" → "Salut!"
        User: "Comment vas-tu?" → "Bien, et toi?"
        User: "Quelle heure est-il?" → "15h30"
        User: "Tu me racontes quoi de beau?" → "Rien de spécial, je profite de la journée. Et toi?"
        User: "Il se passe quoi en Alaska?" → "Probablement froid comme d'habitude! Pourquoi tu demandes?"
        User: "Quoi de neuf?" → "Tranquille, et toi?"

        Réponds naturellement et brièvement.
        `;
    }

    public getSystemPrompt(): string {
        return this.systemPrompt;
    }

    public setSystemPrompt(prompt: string): void {
        this.systemPrompt = prompt;
    }

    public formatPromptWithSystem(userMessage: string): string {
        return `${this.systemPrompt}\n\nUser: ${userMessage}`;
    }

    /**
     * Force la régénération du prompt de détection des skills
     * Utile après l'ajout/suppression de skills
     */
    public refreshSkillDetectionPrompt(): string {
        return this.getSkillDetectionPrompt();
    }

    /**
     * Récupère la liste des skills actifs pour debugging
     */
    public getActiveSkillsList(): string[] {
        return skillManager.getSkillsInfo()
            .filter(skill => skill.enabled)
            .map(skill => skill.name);
    }
}
