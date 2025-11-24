import type { VisualDeviation, BoundingBox, AIFixedImageResult } from '../types';

const NANO_BANANA_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL_NAME = 'gemini-3-pro-image-preview'; // Correct model name for nano-banana-pro-preview

/**
 * Generates AI-fixed image using Gemini's image generation model
 * Uses text-to-image editing approach with precise descriptions of what to fix
 */
export async function generateFixedImage(
    originalImageBase64: string,
    originalImageMimeType: string,
    deviations: VisualDeviation[],
    imageWidth: number,
    imageHeight: number
): Promise<AIFixedImageResult> {
    const startTime = Date.now();

    try {
        // Filter deviations that have bounding boxes
        const deviationsWithBoxes = deviations.filter(d => d.boundingBox);

        if (deviationsWithBoxes.length === 0) {
            return {
                success: false,
                error: 'No localizable issues found. Cannot perform targeted fixes.',
            };
        }

        // Build precise editing prompt with coordinates
        const issueDescriptions = deviationsWithBoxes
            .map((d, i) => {
                const box = d.boundingBox!;
                const xPercent = (box.x * 100).toFixed(0);
                const yPercent = (box.y * 100).toFixed(0);
                const widthPercent = (box.width * 100).toFixed(0);
                const heightPercent = (box.height * 100).toFixed(0);

                return `${i + 1}. ${d.description} (located at ${xPercent}%,${yPercent}% covering ${widthPercent}%x${heightPercent}% area)`;
            })
            .join('\n');

        const editingPrompt = `You are an expert image editor for retail showrooms. Your task is to fix ONLY the specific problems listed below in this showroom image, while keeping everything else EXACTLY as it appears.

PROBLEMS TO FIX:
${issueDescriptions}

CRITICAL EDITING RULES:
1. Fix ONLY the listed problems at their specified locations
2. Do NOT modify, add, or remove ANY other elements (furniture, products, colors, lighting, layout)
3. Make fixes look natural and seamless with the existing environment
4. Do NOT change the overall style, color palette, or ambiance
5. Preserve exact product placement and merchandising layout
6. Do NOT add or remove any products, decorations, or people
7. Fix problems minimally - only address what's explicitly listed

Output a single edited version of the image with only these specific problems corrected.`;

        // Use Gemini's generateContent endpoint with correct format
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${NANO_BANANA_API_KEY}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            text: editingPrompt
                        },
                        {
                            inlineData: {
                                mimeType: originalImageMimeType,
                                data: originalImageBase64
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.4, // Low temperature for consistency
                    topK: 32,
                    topP: 1,
                    maxOutputTokens: 4096
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Extract generated image from response
        if (result.candidates && result.candidates.length > 0) {
            const candidate = result.candidates[0];

            // Look for image in the response parts
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const fixedImageBase64 = part.inlineData.data;
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        const fixedImageUrl = `data:${mimeType};base64,${fixedImageBase64}`;

                        return {
                            success: true,
                            fixedImageBase64,
                            fixedImageUrl,
                            processingTimeMs: Date.now() - startTime,
                        };
                    }
                }
            }

            throw new Error('No image found in API response');
        } else {
            throw new Error('No candidates in API response');
        }

    } catch (error) {
        console.error('Image fix generation failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during image generation',
            processingTimeMs: Date.now() - startTime,
        };
    }
}
