import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ComplianceReport, WorkspaceInventory, WorkspaceViolation, ZoneType } from '../types';
import { buildAuditPrompt } from './prompt';
import { calculateScore } from './scoringEngine';
import { validateAIResponse, sanitizeAIResponse } from './aiValidator';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

interface RawAIResponse {
    _reasoning?: string;
    inventory: WorkspaceInventory;
    raw_deviations: WorkspaceViolation[];
    recommendations: string[];
}

function extractJson(text: string): RawAIResponse | null {
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '');
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
        try {
            return JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1)) as RawAIResponse;
        } catch {
            return null;
        }
    }
    return null;
}

export const getVisualAudit = async (
    imageBase64: string,
    mimeType: string,
    zoneType: ZoneType,
    cvContext?: string,
): Promise<{ thoughtProcess: string; result: ComplianceReport }> => {

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.1,
            candidateCount: 1,
        }
    });

    const basePrompt = buildAuditPrompt(zoneType);
    const prompt = cvContext ? basePrompt + cvContext : basePrompt;
    const imagePart = { inlineData: { data: imageBase64, mimeType } };

    const result = await model.generateContent([prompt, "--- Imagine live de analizat ---", imagePart]);
    const response = await result.response;
    const responseText = response.text();

    const rawData = extractJson(responseText);
    if (!rawData) {
        throw new Error("Nu s-a putut genera un raport valid.");
    }

    const validation = validateAIResponse(rawData);
    if (!validation.isValid) {
        throw new Error(`Validare eșuată: ${validation.errors.join(', ')}`);
    }

    const sanitizedData = sanitizeAIResponse(rawData);
    const computation = calculateScore(sanitizedData.inventory);

    const thoughtProcess = sanitizedData._reasoning || "Analiză directă.";

    return {
        thoughtProcess,
        result: {
            isValid: true,
            zoneType,
            inventory: sanitizedData.inventory,
            violations: sanitizedData.raw_deviations,
            computation,
            recommendations: sanitizedData.recommendations,
        }
    };
};
