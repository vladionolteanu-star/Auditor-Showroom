import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AuditReport, AIInventory, VisualDeviation } from '../types';
import { buildAuditPrompt } from './prompt';
import { calculateScore } from './scoringEngine';

const REFERENCE_IMAGE_INSTRUCTION = `
## IMAGINI DE REFERINȚĂ
Standardul "perfect". Compară imaginea de audit cu acestea.`;

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

function fileToGenerativePart(base64: string, mimeType: string) {
    return { inlineData: { data: base64, mimeType } };
}

// Interface internă actualizată
interface RawAIResponse {
    _reasoning?: string; // Câmpul nou
    inventory: AIInventory;
    raw_deviations: VisualDeviation[];
    recommendations: string[];
}

function extractJson(text: string): RawAIResponse | null {
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '');
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
        try {
            return JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1)) as RawAIResponse;
        } catch (e) {
            console.error("JSON Parse Error:", e);
            return null;
        }
    }
    return null;
}

export const getVisualAudit = async (
    imageBase64: string,
    mimeType: string,
    category: string,
    referenceImages: { base64: string, mimeType: string }[]
): Promise<{ thoughtProcess: string; result: AuditReport; }> => {

    // Păstrăm modelul Gemini 3 Pro Preview
    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

    const auditPrompt = buildAuditPrompt();
    const mainImagePart = fileToGenerativePart(imageBase64, mimeType);
    const referenceImageParts = referenceImages.map(img => fileToGenerativePart(img.base64, img.mimeType));

    const parts: any[] = [];
    if (referenceImageParts.length > 0) {
        parts.push(REFERENCE_IMAGE_INSTRUCTION + "\n\n" + auditPrompt);
        referenceImageParts.forEach(part => parts.push(part));
    } else {
        parts.push(auditPrompt);
    }
    parts.push("--- Imagine de auditat ---");
    parts.push(mainImagePart);

    try {
        console.log('[AUDIT] Starting Gemini API call...');
        const result = await model.generateContent(parts);
        const response = await result.response;
        const responseText = response.text();

        console.log('[AUDIT] Raw AI Response:', responseText.substring(0, 500) + '...');

        const rawData = extractJson(responseText);

        if (!rawData) {
            console.error('[AUDIT] Failed to extract JSON from response');
            throw new Error("Nu s-a putut genera un raport valid.");
        }

        console.log('[AUDIT] Parsed JSON data:', {
            hasReasoning: !!rawData._reasoning,
            inventoryCount: Object.keys(rawData.inventory || {}).length,
            deviationsCount: rawData.raw_deviations?.length || 0,
            recommendationsCount: rawData.recommendations?.length || 0
        });

        // Verificăm dacă avem deviații cu bounding boxes
        if (rawData.raw_deviations) {
            const deviationsWithBoxes = rawData.raw_deviations.filter(d => d.boundingBox);
            console.log('[AUDIT] Deviations with bounding boxes:', deviationsWithBoxes.length);
            if (deviationsWithBoxes.length > 0) {
                console.log('[AUDIT] Sample bounding box:', deviationsWithBoxes[0].boundingBox);
            }
        }

        // --- CALCUL SCOR ---
        const computation = calculateScore(rawData.inventory);
        console.log('[AUDIT] Score computed:', computation);

        // --- ETRAGERE THOUGHT PROCESS ---
        // Dacă există _reasoning în JSON, îl folosim. Altfel fallback.
        const thoughtProcess = rawData._reasoning
            ? rawData._reasoning
            : "Analiză directă (fără reasoning detaliat).";

        const finalReport: AuditReport = {
            isValid: true,
            category: category,
            inventory: rawData.inventory,
            raw_deviations: rawData.raw_deviations,
            computation: computation,
            recommendations: rawData.recommendations
        };

        console.log('[AUDIT] Final report created successfully');

        return {
            thoughtProcess,
            result: finalReport
        };

    } catch (error) {
        console.error("[AUDIT] Eroare Gemini:", error);
        console.error("[AUDIT] Error details:", {
            message: error instanceof Error ? error.message : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
};