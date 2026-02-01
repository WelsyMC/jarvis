import { SystemPromptManager } from './system_prompt';

const promptManager = new SystemPromptManager();

/**
 * Détecte les skills à utiliser (premier appel IA)
 */
export async function detectSkills(question: string): Promise<string> {
    try {
        const skillDetectionPrompt = promptManager.getSkillDetectionPrompt();
        const formattedPrompt = `${skillDetectionPrompt}\n\nUser: ${question}`;
        
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'mistral:7b',
                prompt: formattedPrompt,
                stream: false,
                options: {
                    temperature: 0.1,        // Très déterministe pour la détection
                    top_p: 0.5,             
                    top_k: 10,              
                    repeat_penalty: 1.2,    
                    num_predict: 150        
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }

        const data = await response.json();
        return (data as any).response;
    } catch (error) {
        console.error('Error detecting skills:', error);
        throw error;
    }
}

/**
 * Génère la réponse à l'utilisateur (second appel IA)
 */
export async function sendMessageToAI(question: string): Promise<string> {
    try {
        const formattedPrompt = promptManager.formatPromptWithSystem(question);
        
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'mistral:7b',
                prompt: formattedPrompt,
                stream: false,
                options: {
                    temperature: 0.3,        // Plus bas = plus déterministe et précis (0-1, défaut 0.8)
                    top_p: 0.7,             // Plus bas = plus focalisé (0-1, défaut 0.9)
                    top_k: 20,              // Réduit les options aléatoires (défaut 40)
                    repeat_penalty: 1.2,    // Évite les répétitions
                    num_predict: 200        // Limite la longueur des réponses
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }

        const data = await response.json();
        return (data as any).response;
    } catch (error) {
        console.error('Error calling Ollama:', error);
        throw error;
    }
}

export function setSystemPrompt(prompt: string): void {
    promptManager.setSystemPrompt(prompt);
}

export function getSystemPrompt(): string {
    return promptManager.getSystemPrompt();
}