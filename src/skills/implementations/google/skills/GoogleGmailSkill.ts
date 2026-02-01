import { SkillBase, SkillData, SkillDetectionResult, SkillExecutionResult } from "@base/SkillBase";
import { Context, NarrowedContext } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";
import { GoogleGmailClient } from "../clients/GoogleGmailClient";

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
export class GoogleGmailSkill extends SkillBase {
    public readonly name = "GMail";
    public readonly description = "Récupère les e-mails récents.";

    constructor(
        private gmailClient?: GoogleGmailClient
    ){
        super();
        this.gmailClient = gmailClient;
    }

    /**
     * Détecte si ce skill doit être utilisé
     * Format attendu: [SKILL: gmail] Expression: "2 + 3" ou Operation: "add" Numbers: [2, 3]
     */
    public detectSkill(skillDetection: string): SkillDetectionResult {
        const calcMatch = skillDetection.match(/\[SKILL:\s*gmail\]/i);
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

        return {
            isDetected: true,
            data: {
            }
        };
    }

    /**
     * Exécute le skill calculator
     */
    public async execute(
        data: SkillData,
        userId: string,
        messageSender: any
    ): Promise<SkillExecutionResult> {
        return {
            success: true,
            message: "GMail executed successfully.",
            requiresResponse: true,
            responseData: {}
        };
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
