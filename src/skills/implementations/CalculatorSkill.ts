import { SkillBase, SkillData, SkillDetectionResult, SkillExecutionResult } from "../base/SkillBase";
import { Context, NarrowedContext } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";

/**
 * Interface pour les données du skill Calculator
 */
export interface CalculatorSkillData extends SkillData {
    expression: string;
    operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'evaluate';
    numbers?: number[];
}

/**
 * Skill d'exemple pour effectuer des calculs simples
 * Démontre la facilité d'ajout de nouveaux skills
 */
export class CalculatorSkill extends SkillBase {
    public readonly name = "calculator";
    public readonly description = "Effectue des calculs mathématiques simples";

    /**
     * Détecte si ce skill doit être utilisé
     * Format attendu: [SKILL: calculator] Expression: "2 + 3" ou Operation: "add" Numbers: [2, 3]
     */
    public detectSkill(skillDetection: string): SkillDetectionResult {
        const calcMatch = skillDetection.match(/\[SKILL:\s*calculator\]/i);
        if (!calcMatch) {
            return { isDetected: false };
        }

        // Essayer de parser une expression
        const expressionMatch = skillDetection.match(/Expression:\s*"([^"]+)"/i);
        if (expressionMatch) {
            return {
                isDetected: true,
                data: {
                    expression: expressionMatch[1],
                    operation: 'evaluate'
                }
            };
        }

        // Essayer de parser une opération avec nombres
        const operationMatch = skillDetection.match(/Operation:\s*"([^"]+)"/i);
        const numbersMatch = skillDetection.match(/Numbers:\s*\[([^\]]+)\]/i);

        if (operationMatch && numbersMatch) {
            const operation = operationMatch[1].toLowerCase();
            if (!['add', 'subtract', 'multiply', 'divide'].includes(operation)) {
                return { isDetected: false };
            }

            try {
                const numbers = numbersMatch[1].split(',').map(n => parseFloat(n.trim()));
                return {
                    isDetected: true,
                    data: {
                        operation: operation as CalculatorSkillData['operation'],
                        numbers: numbers,
                        expression: `${numbers.join(` ${this.getOperatorSymbol(operation as any)} `)}`
                    }
                };
            } catch (error) {
                return { isDetected: false };
            }
        }

        return { isDetected: false };
    }

    /**
     * Exécute le skill calculator
     */
    public async execute(
        data: SkillData,
        userId: string,
        messageSender: any
    ): Promise<SkillExecutionResult> {
        try {
            const calcData = data as CalculatorSkillData;

            if (!this.validateData(calcData)) {
                return {
                    success: false,
                    error: "Données invalides pour le skill calculator"
                };
            }

            let result: number;
            let formattedExpression: string;

            if (calcData.operation === 'evaluate') {
                // Évaluer une expression (sécurisée)
                result = this.evaluateExpression(calcData.expression);
                formattedExpression = calcData.expression;
            } else {
                // Effectuer l'opération sur les nombres
                result = this.performOperation(calcData.operation, calcData.numbers!);
                formattedExpression = calcData.expression;
            }

            const message = this.formatCalculationResult(formattedExpression, result);

            return {
                success: true,
                message: message,
                requiresResponse: true,
                responseData: { expression: formattedExpression, result, skillName: 'calculator' }
            };

        } catch (error) {
            console.error("[CALCULATOR_SKILL] Erreur lors de l'exécution:", error);
            return {
                success: false,
                error: "❌ Erreur lors du calcul. Vérifiez l'expression mathématique."
            };
        }
    }

    /**
     * Valide les données du skill
     */
    public validateData(data: SkillData): boolean {
        const calcData = data as CalculatorSkillData;
        
        if (!calcData.operation) return false;
        
        if (calcData.operation === 'evaluate') {
            return !!(calcData.expression && typeof calcData.expression === 'string');
        }
        
        return !!(calcData.numbers && 
                 Array.isArray(calcData.numbers) && 
                 calcData.numbers.length >= 2 &&
                 calcData.numbers.every(n => typeof n === 'number' && !isNaN(n)));
    }

    /**
     * Évalue une expression mathématique de manière sécurisée
     */
    private evaluateExpression(expression: string): number {
        // Nettoyer l'expression (sécurité basique)
        const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
        
        // Expressions interdites pour la sécurité
        if (sanitized.includes('Math') || sanitized.includes('eval') || sanitized.includes('function')) {
            throw new Error("Expression non autorisée");
        }

        // Évaluation simple (dans un vrai projet, utilisez une bibliothèque math sécurisée)
        try {
            return Function(`"use strict"; return (${sanitized})`)();
        } catch (error) {
            throw new Error("Expression invalide");
        }
    }

    /**
     * Effectue une opération mathématique
     */
    private performOperation(operation: CalculatorSkillData['operation'], numbers: number[]): number {
        switch (operation) {
            case 'add':
                return numbers.reduce((a, b) => a + b, 0);
            case 'subtract':
                return numbers.reduce((a, b) => a - b);
            case 'multiply':
                return numbers.reduce((a, b) => a * b, 1);
            case 'divide':
                return numbers.reduce((a, b) => {
                    if (b === 0) throw new Error("Division par zéro");
                    return a / b;
                });
            default:
                throw new Error("Opération non reconnue");
        }
    }

    /**
     * Récupère le symbole d'opérateur
     */
    private getOperatorSymbol(operation: string): string {
        const symbols = {
            'add': '+',
            'subtract': '-',
            'multiply': '×',
            'divide': '÷'
        };
        return symbols[operation as keyof typeof symbols] || operation;
    }

    /**
     * Formate le résultat du calcul
     */
    private formatCalculationResult(expression: string, result: number): string {
        const formattedResult = Number.isInteger(result) ? result.toString() : result.toFixed(2);
        
        return `🧮 **Calculatrice**\n\n` +
               `**Expression**: ${expression}\n` +
               `**Résultat**: ${formattedResult}`;
    }
}

/*
Exemple d'utilisation dans l'IA:

Pour ajouter ce skill:
1. Décommentez la ligne dans SkillManager.ts:
   this.registerSkill(new CalculatorSkill());

2. Ajoutez l'export dans index.ts:
   export { CalculatorSkill, type CalculatorSkillData } from "./implementations/CalculatorSkill";

3. L'IA devra retourner des détections comme:
   [SKILL: calculator] Expression: "15 + 25 * 2"
   ou
   [SKILL: calculator] Operation: "add" Numbers: [10, 20, 30]
*/