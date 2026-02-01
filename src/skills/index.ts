// Export des classes de base
export { SkillBase, type SkillData, type SkillDetectionResult, type SkillExecutionResult } from "./base/SkillBase";

// Export du gestionnaire
export { SkillManager, type SkillRegistration } from "./SkillManager";

// Lazy initialization of skillManager to allow dotenv to load first
import { SkillManager } from "./SkillManager";

let _skillManager: SkillManager | null = null;

export function getSkillManager(): SkillManager {
    if (!_skillManager) {
        _skillManager = new SkillManager();
    }
    return _skillManager;
}

// Export des skills implémentés
export { CronSkill, type CronSkillData } from "./implementations/CronSkill";
export { WebSearchSkill, type WebSearchSkillData } from "./implementations/web/WebSearchSkill";
export { SystemInfoSkill, type SystemInfoSkillData } from "./implementations/SystemInfoSkill";