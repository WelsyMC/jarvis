// Export des classes de base
export { SkillBase, type SkillData, type SkillDetectionResult, type SkillExecutionResult } from "./base/SkillBase";

// Export du gestionnaire
export { SkillManager, skillManager, type SkillRegistration } from "./SkillManager";

// Export des skills implémentés
export { CronSkill, type CronSkillData } from "./implementations/CronSkill";
export { WebSearchSkill, type WebSearchSkillData } from "./implementations/WebSearchSkill";
export { SystemInfoSkill, type SystemInfoSkillData } from "./implementations/SystemInfoSkill";