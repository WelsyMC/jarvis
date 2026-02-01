# Système de Skills J.A.R.V.I.S

## Vue d'ensemble

Le système de skills a été refactorisé pour utiliser une architecture orientée objet modulaire qui élimine les longues chaînes if/else et permet d'ajouter facilement de nouveaux skills.

## Avantages de la nouvelle architecture

✅ **Extensibilité** : Ajouter un skill = créer une classe et l'enregistrer  
✅ **Maintenabilité** : Chaque skill est isolé dans sa propre classe  
✅ **Testabilité** : Tests unitaires indépendants pour chaque skill  
✅ **Configuration** : Activation/désactivation dynamique des skills  
✅ **Réutilisabilité** : Skills réutilisables dans d'autres contextes  

## Structure des fichiers

```
src/skills/
├── base/
│   └── SkillBase.ts              # Classe abstraite de base
├── implementations/
│   ├── CronSkill.ts              # Rappels programmés
│   ├── WebSearchSkill.ts         # Recherche web
│   ├── SystemInfoSkill.ts        # Infos système (exemple)
│   └── CalculatorSkill.ts        # Calculatrice (exemple)
├── SkillManager.ts               # Gestionnaire centralisé
└── index.ts                      # Exports publics
```

## Skills disponibles

### CronSkill
- **Fonction** : Planification de rappels et tâches différées
- **Format** : `[SKILL: cron] Prompt: "message" Délai: 30s`
- **Exemple** : Programmer un rappel dans 5 minutes

### WebSearchSkill  
- **Fonction** : Recherche web avec synthèse IA
- **Format** : `[SKILL: web_search] Query: "recherche"`
- **Exemple** : Chercher des informations actuelles

### SystemInfoSkill (désactivé par défaut)
- **Fonction** : Informations système (date, heure, mémoire, etc.)
- **Format** : `[SKILL: system_info] Type: "time"`
- **Exemple** : Obtenir l'heure actuelle

### CalculatorSkill (exemple non activé)
- **Fonction** : Calculs mathématiques simples
- **Format** : `[SKILL: calculator] Expression: "2 + 3 * 4"`
- **Exemple** : Effectuer des opérations mathématiques

## Ajouter un nouveau skill

### 1. Créer la classe du skill

```typescript
// src/skills/implementations/MonNouveauSkill.ts
import { SkillBase, SkillData, SkillDetectionResult, SkillExecutionResult } from "../base/SkillBase";

export interface MonSkillData extends SkillData {
    // Propriétés spécifiques au skill
    param1: string;
    param2: number;
}

export class MonNouveauSkill extends SkillBase {
    public readonly name = "mon_nouveau_skill";
    public readonly description = "Description de mon skill";

    public detectSkill(skillDetection: string): SkillDetectionResult {
        const match = skillDetection.match(/\[SKILL:\s*mon_nouveau_skill\]/i);
        if (!match) return { isDetected: false };
        
        // Logique de parsing...
        return { isDetected: true, data: { /* données */ } };
    }

    public async execute(data, ctx, userId): Promise<SkillExecutionResult> {
        try {
            // Logique d'exécution...
            return {
                success: true,
                message: "Résultat du skill",
                requiresResponse: true
            };
        } catch (error) {
            return { success: false, error: "Erreur dans le skill" };
        }
    }

    public validateData(data: SkillData): boolean {
        // Validation...
        return true;
    }
}
```

### 2. Enregistrer le skill

Dans `src/skills/SkillManager.ts`, ajoutez dans `registerDefaultSkills()` :

```typescript
this.registerSkill(new MonNouveauSkill());
```

### 3. Exporter le skill

Dans `src/skills/index.ts` :

```typescript
export { MonNouveauSkill, type MonSkillData } from "./implementations/MonNouveauSkill";
```

### 4. Tester le skill

Le skill sera automatiquement détecté et exécuté quand l'IA retournera :

```
[SKILL: mon_nouveau_skill]
Param1: "valeur"
Param2: 42
```

## API du SkillManager

```typescript
// Accès au gestionnaire
import { skillManager } from "../skills";

// Enregistrer un skill
skillManager.registerSkill(new MonSkill());

// Désactiver un skill
skillManager.disableSkill("mon_skill");

// Activer un skill
skillManager.enableSkill("mon_skill");

// Obtenir les skills actifs
const skills = skillManager.getSkills(true);

// Obtenir les informations des skills
const infos = skillManager.getSkillsInfo();

// Traiter une détection (utilisé automatiquement par le bot)
const result = await skillManager.processSkillDetection(detection, ctx, userId);
```

## Flux d'exécution

1. **Message utilisateur** → Bot Telegram
2. **Détection IA** → `detectSkills(message)`
3. **Parsing** → `skillManager.processSkillDetection()`
4. **Exécution** → Skill approprié
5. **Réponse** → Message formaté à l'utilisateur

## Migration depuis l'ancien système

L'ancien système avec des if/else dans `telegram_bot.ts` a été remplacé par :
- Classes orientées objet pour chaque skill
- Gestionnaire centralisé pour l'orchestration
- Détection automatique des skills
- Exécution modulaire

Cette architecture permet de :
- **Éviter les if/else de 3000 lignes** 
- **Ajouter des skills sans modifier le code existant**
- **Maintenir et tester chaque skill indépendamment**
- **Configurer l'activation/désactivation des skills**

## Exemples d'utilisation

Pour activer le skill Calculator par exemple :

1. Décommentez dans `SkillManager.ts` :
   ```typescript
   this.registerSkill(new CalculatorSkill());
   ```

2. L'IA pourra alors retourner :
   ```
   [SKILL: calculator] Expression: "15 + 25 * 2"
   ```

3. Le skill calculera automatiquement le résultat et le retournera formaté.

## Documentation technique

Voir [docs/skills_architecture.md](../docs/skills_architecture.md) pour plus de détails techniques.