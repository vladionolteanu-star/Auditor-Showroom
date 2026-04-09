import type { WorkspaceInventory } from '../types';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export function validateAIResponse(data: {
    inventory: WorkspaceInventory;
    raw_deviations: any[];
    recommendations: string[];
}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. disorder_score
    if (data.inventory.disorder_score === undefined || data.inventory.disorder_score === null) {
        errors.push('Missing inventory field: disorder_score');
    } else if (typeof data.inventory.disorder_score !== 'number' || data.inventory.disorder_score < 0 || data.inventory.disorder_score > 10) {
        errors.push(`disorder_score should be 0-10, got ${data.inventory.disorder_score}`);
    }

    // 2. Boolean fields
    for (const field of ['has_personal_items', 'has_document_clutter', 'has_clear_workspace'] as const) {
        if (typeof data.inventory[field] !== 'boolean') {
            warnings.push(`${field} should be boolean, got ${typeof data.inventory[field]}`);
        }
    }

    // 3. Deviations
    if (!Array.isArray(data.raw_deviations)) {
        errors.push('raw_deviations should be an array');
    } else {
        data.raw_deviations.forEach((dev, index) => {
            if (!dev.description || typeof dev.description !== 'string') {
                errors.push(`Deviation ${index}: missing or invalid description`);
            }
            if (dev.boundingBox) {
                const { x, y, width, height } = dev.boundingBox;
                if (typeof x !== 'number' || x < 0 || x > 1) errors.push(`Deviation ${index}: boundingBox.x must be in [0,1]`);
                if (typeof y !== 'number' || y < 0 || y > 1) errors.push(`Deviation ${index}: boundingBox.y must be in [0,1]`);
                if (typeof width !== 'number' || width < 0 || width > 1) errors.push(`Deviation ${index}: boundingBox.width must be in [0,1]`);
                if (typeof height !== 'number' || height < 0 || height > 1) errors.push(`Deviation ${index}: boundingBox.height must be in [0,1]`);
                if (width < 0.01 || height < 0.01) warnings.push(`Deviation ${index}: bounding box very small`);
            }
        });
    }

    return { isValid: errors.length === 0, errors, warnings };
}

export function sanitizeAIResponse(data: any): any {
    const sanitized = JSON.parse(JSON.stringify(data));

    if (sanitized.inventory) {
        sanitized.inventory.disorder_score = Math.max(0, Math.min(10, Math.round(Number(sanitized.inventory.disorder_score) || 0)));
        sanitized.inventory.has_personal_items = Boolean(sanitized.inventory.has_personal_items);
        sanitized.inventory.has_document_clutter = Boolean(sanitized.inventory.has_document_clutter);
        sanitized.inventory.has_clear_workspace = Boolean(sanitized.inventory.has_clear_workspace);
    }

    if (Array.isArray(sanitized.raw_deviations)) {
        sanitized.raw_deviations = sanitized.raw_deviations.map((dev: any) => {
            if (dev.boundingBox) {
                dev.boundingBox.x = Math.max(0, Math.min(1, dev.boundingBox.x));
                dev.boundingBox.y = Math.max(0, Math.min(1, dev.boundingBox.y));
                dev.boundingBox.width = Math.max(0, Math.min(1 - dev.boundingBox.x, dev.boundingBox.width));
                dev.boundingBox.height = Math.max(0, Math.min(1 - dev.boundingBox.y, dev.boundingBox.height));
            }
            if (!dev.severity) dev.severity = "Medie";
            return dev;
        });
    }

    return sanitized;
}
