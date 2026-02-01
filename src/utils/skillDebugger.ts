/**
 * Utilitaire pour tester et déboguer le système de skills dynamique
 */

import { getSkillManager } from '../skills';
import { SystemPromptManager } from '../ai_bridge/system_prompt';

/**
 * Affiche le prompt de détection de skills généré dynamiquement
 */
export function debugSkillDetectionPrompt(): void {
    console.log('\n=== PROMPT DE DÉTECTION DE SKILLS (DYNAMIQUE) ===');
    
    const promptManager = new SystemPromptManager();
    const prompt = promptManager.getSkillDetectionPrompt();
    
    console.log(prompt);
    console.log('\n=== FIN DU PROMPT ===\n');
}

/**
 * Affiche les informations sur les skills actifs
 */
export function debugActiveSkills(): void {
    console.log('\n=== SKILLS ACTIFS ===');
    
    const skillsInfo = getSkillManager().getSkillsInfo();
    const activeSkills = skillsInfo.filter(skill => skill.enabled);
    const inactiveSkills = skillsInfo.filter(skill => !skill.enabled);
    
    console.log(`🟢 Skills actifs (${activeSkills.length}):`);
    activeSkills.forEach(skill => {
        console.log(`   - ${skill.name}: ${skill.description}`);
    });
    
    if (inactiveSkills.length > 0) {
        console.log(`🔴 Skills inactifs (${inactiveSkills.length}):`);
        inactiveSkills.forEach(skill => {
            console.log(`   - ${skill.name}: ${skill.description}`);
        });
    }
    
    console.log('\n=== FIN DES SKILLS ===\n');
}

/**
 * Teste l'activation/désactivation dynamique des skills
 */
export function testDynamicSkillToggling(): void {
    console.log('\n=== TEST DE BASCULEMENT DYNAMIQUE ===');
    
    console.log('État initial:');
    debugActiveSkills();
    
    // Désactiver un skill
    console.log('Désactivation du skill web_search...');
    getSkillManager().disableSkill('web_search');
    debugActiveSkills();
    
    // Réactiver le skill
    console.log('Réactivation du skill web_search...');
    getSkillManager().enableSkill('web_search');
    debugActiveSkills();
    
    console.log('=== FIN DU TEST ===\n');
}

/**
 * Affiche un comparatif avant/après pour montrer la différence
 */
export function demonstrateDynamicPrompt(): void {
    console.log('\n=== DÉMONSTRATION DU PROMPT DYNAMIQUE ===');
    
    const promptManager = new SystemPromptManager();
    
    console.log('1. Prompt avec tous les skills actifs:');
    debugActiveSkills();
    debugSkillDetectionPrompt();
    
    console.log('2. Désactivation de quelques skills...');
    getSkillManager().disableSkill('system_info');
    getSkillManager().disableSkill('web_search');
    
    console.log('3. Prompt mis à jour automatiquement:');
    debugActiveSkills();
    debugSkillDetectionPrompt();
    
    console.log('4. Réactivation des skills...');
    getSkillManager().enableSkill('system_info');
    getSkillManager().enableSkill('web_search');
    
    console.log('5. Prompt final:');
    debugActiveSkills();
    
    console.log('=== FIN DE LA DÉMONSTRATION ===\n');
}

// Auto-exécution si ce fichier est lancé directement
if (require.main === module) {
    demonstrateDynamicPrompt();
}