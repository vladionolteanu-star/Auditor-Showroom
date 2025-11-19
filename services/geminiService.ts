import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AuditReport } from '../types';
import { buildAuditPrompt } from './prompt';

const REFERENCE_IMAGE_INSTRUCTION = `
## IMAGINI DE REFERINȚĂ
Ți-au fost furnizate imagini de referință care reprezintă standardul "perfect" sau "de aur". Folosește-le ca bază principală de comparație pentru evaluarea ta. Abaterile de la aceste standarde trebuie penalizate.`;

// Aici preluam cheia din .env.local
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Initializam clientul
const genAI = new GoogleGenerativeAI(apiKey || "");

function fileToGenerativePart(base64: string, mimeType: string) {
  return {
    inlineData: {
      data: base64,
      mimeType
    },
  };
}

function extractJson(text: string): AuditReport | null {
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '');
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(jsonString) as AuditReport;
        } catch (e) {
            console.error("Eșec la parsarea JSON:", e);
            return null;
        }
    }
    return null;
}

export const getVisualAudit = async (
    imageBase64: string, 
    mimeType: string,
    category: 'Info Point Birouri' | 'Intrare' | 'Best Seller' | 'Rafturi',
    referenceImages: { base64: string, mimeType: string }[]
): Promise<{ thoughtProcess: string; result: AuditReport; }> => {
    
    // Folosim Gemini 1.5 Pro care e stabil si puternic
    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

    const auditPrompt = buildAuditPrompt();
    const mainImagePart = fileToGenerativePart(imageBase64, mimeType);
    const referenceImageParts = referenceImages.map(img => fileToGenerativePart(img.base64, img.mimeType));

    const parts: any[] = [];
    
    if (referenceImageParts.length > 0) {
        parts.push(REFERENCE_IMAGE_INSTRUCTION + "\n\n" + auditPrompt);
        parts.push("--- Imagini de referință ---");
        referenceImageParts.forEach(part => parts.push(part));
    } else {
        parts.push(auditPrompt);
    }

    parts.push("--- Imagine de auditat ---");
    parts.push(mainImagePart);
    
    try {
        const result = await model.generateContent(parts);
        const response = await result.response;
        const responseText = response.text();
        
        let thoughtProcess = "Analiză efectuată.";
        const jsonStartIndex = responseText.indexOf('{');
        if (jsonStartIndex > 0) {
            thoughtProcess = responseText.substring(0, jsonStartIndex).trim();
        }

        const parsedResult = extractJson(responseText);

        if (!parsedResult) {
            throw new Error("Nu s-a putut genera un raport valid (JSON invalid).");
        }

        return {
            thoughtProcess,
            result: parsedResult
        };

    } catch (error) {
        console.error("Eroare Gemini:", error);
        throw error;
    }
};