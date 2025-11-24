import type { AIInventory } from '../types';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validează răspunsul AI pentru a detecta:
 * 1. Câmpuri lipsă sau invalid formatate
 * 2. Bounding boxes în afara intervalului [0,1]
 * 3. Severități invalide
 * 4. Inconsistențe între inventory și deviations
 */
export function validateAIResponse(data: {
    inventory: AIInventory;
    raw_deviations: any[];
    recommendations: string[];
}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Verifică completitudinea inventory
    const requiredFields: (keyof AIInventory)[] = [
        'has_logistics_visible',
        'has_safety_hazards',
        'cleanliness_issues_count',
        'damaged_products_count',
        'open_drawers_doors_count',
        'shelf_voids_count',
        'disorganized_shelf_stock',
        'fallen_products_count',
        'checkout_clutter_detected',
        'missing_price_tags_count',
        'fallen_signage_count'
    ];

    for (const field of requiredFields) {
        if (data.inventory[field] === undefined || data.inventory[field] === null) {
            errors.push(`Missing or null inventory field: ${field}`);
        }
    }

    // 2. Validează tipurile de date
    const booleanFields: (keyof AIInventory)[] = [
        'has_logistics_visible',
        'has_safety_hazards',
        'disorganized_shelf_stock',
        'checkout_clutter_detected'
    ];

    for (const field of booleanFields) {
        if (typeof data.inventory[field] !== 'boolean') {
            errors.push(`Field ${field} should be boolean, got ${typeof data.inventory[field]}`);
        }
    }

    const numberFields: (keyof AIInventory)[] = [
        'cleanliness_issues_count',
        'damaged_products_count',
        'open_drawers_doors_count',
        'shelf_voids_count',
        'fallen_products_count',
        'missing_price_tags_count',
        'fallen_signage_count'
    ];

    for (const field of numberFields) {
        const value = data.inventory[field];
        if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
            errors.push(`Field ${field} should be a non-negative integer, got ${value}`);
        }
    }

    // 3. Validează deviations
    if (!Array.isArray(data.raw_deviations)) {
        errors.push('raw_deviations should be an array');
    } else {
        const validSeverities = ['CRITICĂ', 'Mare', 'Medie', 'Mică'];

        data.raw_deviations.forEach((dev, index) => {
            // Verifică câmpurile obligatorii
            if (!dev.description || typeof dev.description !== 'string') {
                errors.push(`Deviation ${index}: missing or invalid description`);
            }

            if (!dev.severity || !validSeverities.includes(dev.severity)) {
                errors.push(`Deviation ${index}: invalid severity "${dev.severity}". Must be one of: ${validSeverities.join(', ')}`);
            }

            // Validează bounding box (dacă există)
            if (dev.boundingBox) {
                const { x, y, width, height } = dev.boundingBox;

                if (typeof x !== 'number' || x < 0 || x > 1) {
                    errors.push(`Deviation ${index}: boundingBox.x must be in [0, 1], got ${x}`);
                }
                if (typeof y !== 'number' || y < 0 || y > 1) {
                    errors.push(`Deviation ${index}: boundingBox.y must be in [0, 1], got ${y}`);
                }
                if (typeof width !== 'number' || width < 0 || width > 1) {
                    errors.push(`Deviation ${index}: boundingBox.width must be in [0, 1], got ${width}`);
                }
                if (typeof height !== 'number' || height < 0 || height > 1) {
                    errors.push(`Deviation ${index}: boundingBox.height must be in [0, 1], got ${height}`);
                }

                // Verifică că box-ul nu depășește limitele imaginii
                if (x + width > 1) {
                    warnings.push(`Deviation ${index}: bounding box extends beyond image width (x + width = ${x + width})`);
                }
                if (y + height > 1) {
                    warnings.push(`Deviation ${index}: bounding box extends beyond image height (y + height = ${y + height})`);
                }

                // Avertizare pentru boxuri prea mici (probabil erori)
                if (width < 0.01 || height < 0.01) {
                    warnings.push(`Deviation ${index}: bounding box is very small (${width}x${height}). Possible error?`);
                }
            }
        });
    }

    // 4. Validează recommendations
    if (!Array.isArray(data.recommendations)) {
        errors.push('recommendations should be an array');
    } else if (data.recommendations.length === 0 && data.raw_deviations.length > 0) {
        warnings.push('Found deviations but no recommendations provided');
    }

    // 5. Verifică consistență între inventory și deviations
    const logisticsDeviations = data.raw_deviations.filter(d =>
        d.description && d.description.toLowerCase().includes('cutie') ||
        d.description && d.description.toLowerCase().includes('palet')
    );

    if (data.inventory.has_logistics_visible && logisticsDeviations.length === 0) {
        warnings.push('Inventory indicates logistics visible but no logistics-related deviations found');
    }

    if (!data.inventory.has_logistics_visible && logisticsDeviations.length > 0) {
        warnings.push('Found logistics-related deviations but inventory.has_logistics_visible is false');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Sanitizează răspunsul AI pentru a corecta erori minore
 */
export function sanitizeAIResponse(data: any): any {
    // Clonează obiectul pentru a nu modifica originalul
    const sanitized = JSON.parse(JSON.stringify(data));

    // Corecție 1: Asigură că toate câmpurile numerice sunt integers
    const numberFields = [
        'cleanliness_issues_count',
        'damaged_products_count',
        'open_drawers_doors_count',
        'shelf_voids_count',
        'fallen_products_count',
        'missing_price_tags_count',
        'fallen_signage_count'
    ];

    for (const field of numberFields) {
        if (sanitized.inventory[field] !== undefined) {
            sanitized.inventory[field] = Math.max(0, Math.floor(Number(sanitized.inventory[field]) || 0));
        }
    }

    // Corecție 2: Clampează bounding boxes în [0, 1]
    if (Array.isArray(sanitized.raw_deviations)) {
        sanitized.raw_deviations = sanitized.raw_deviations.map((dev: any) => {
            if (dev.boundingBox) {
                dev.boundingBox.x = Math.max(0, Math.min(1, dev.boundingBox.x));
                dev.boundingBox.y = Math.max(0, Math.min(1, dev.boundingBox.y));
                dev.boundingBox.width = Math.max(0, Math.min(1 - dev.boundingBox.x, dev.boundingBox.width));
                dev.boundingBox.height = Math.max(0, Math.min(1 - dev.boundingBox.y, dev.boundingBox.height));
            }
            return dev;
        });
    }

    return sanitized;
}
