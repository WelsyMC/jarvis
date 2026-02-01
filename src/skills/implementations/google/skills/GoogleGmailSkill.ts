import { SkillBase, SkillData, SkillDetectionResult, SkillExecutionResult } from "@base/SkillBase";
import { Context, NarrowedContext } from "telegraf";
import { Update, Message } from "telegraf/typings/core/types/typegram";
import { GoogleGmailClient } from "../clients/GoogleGmailClient";
import { writeFileSync } from "node:fs";
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
    ) {
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
        const response = await this.gmailClient?.listMessages(5);
        if (!response || !response.data.messages) {
            return {
                success: true,
                message: "No messages found in the inbox.",
                requiresResponse: false,
                responseData: {}
            };
        }

        // Afficher les détails des mails récupérés
        for (const message of response.data.messages || []) {
            const details = await this.gmailClient?.getMessageDetails(message.id!);
            const headers = details?.data.payload?.headers || [];
            const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
            const date = headers.find((h: any) => h.name === 'Date')?.value || 'Unknown';
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No subject)';
            
            console.log(`📧 From: ${from} | Date: ${date} | Subject: ${subject}`);
        }
        
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

}
