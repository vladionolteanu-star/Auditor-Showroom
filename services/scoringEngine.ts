import type { AIInventory, CalculatedScore } from '../types';

export const calculateScore = (inventory: AIInventory): CalculatedScore => {
    let score = 100;
    const penalties: string[] = [];

    // --- 1. CURĂȚENIE & SIGURANȚĂ (CRITIC - ZERO TOLERANCE) ---
    // PENALITATE AUTOMATĂ CRITICĂ pentru orice problemă de curățenie
    if (inventory.cleanliness_issues_count > 0) {
        score -= 25; // PENALITATE FIXĂ CRITICĂ
        penalties.push("-25p: ⚠️ CRITIC - Probleme de curățenie (pete/murdărie/apă)");

        // Penalitate adițională per zonă afectată
        const additionalP = (inventory.cleanliness_issues_count - 1) * 4;
        if (additionalP > 0) {
            score -= additionalP;
            penalties.push(`-${additionalP}p: ${inventory.cleanliness_issues_count - 1} zone suplimentare afectate`);
        }
    }

    if (inventory.has_logistics_visible) {
        score -= 16;
        penalties.push("-16p: Logistică (cutii/paleți) vizibilă în zona clienți");
    }
    if (inventory.has_safety_hazards) {
        score -= 20;
        penalties.push("-20p: Pericol siguranță (cabluri/lichide/sticle)");
    }

    // --- 2. ORDINE & PREZENTARE MOBILIER ---
    if (inventory.damaged_products_count > 0) {
        const p = inventory.damaged_products_count * 12;
        score -= p;
        penalties.push(`-${p}p: ${inventory.damaged_products_count} produse deteriorate vizibil`);
    }
    if (inventory.open_drawers_doors_count > 0) {
        const p = inventory.open_drawers_doors_count * 4;
        score -= p;
        penalties.push(`-${p}p: ${inventory.open_drawers_doors_count} uși/sertare uitate deschise`);
    }

    // --- 3. MERCHANDISING & RAFTURI ---
    if (inventory.shelf_voids_count > 0) {
        const p = inventory.shelf_voids_count * 10;
        score -= p;
        penalties.push(`-${p}p: ${inventory.shelf_voids_count} goluri (gaps) în raft`);
    }
    if (inventory.disorganized_shelf_stock) {
        score -= 8;
        penalties.push("-8p: Aranjament haotic/nealiniat la raft");
    }
    if (inventory.fallen_products_count > 0) {
        const p = inventory.fallen_products_count * 6;
        score -= p;
        penalties.push(`-${p}p: ${inventory.fallen_products_count} produse căzute/răsturnate`);
    }

    // --- 4. ZONE OPERAȚIONALE ---
    if (inventory.checkout_clutter_detected) {
        score -= 12;
        penalties.push("-12p: Dezordine (clutter) pe desk-ul operativ");
    }

    // --- 5. PREȚURI & MARKETING ---
    if (inventory.missing_price_tags_count > 0) {
        const p = inventory.missing_price_tags_count * 6;
        score -= p;
        penalties.push(`-${p}p: ${inventory.missing_price_tags_count} etichete lipsă`);
    }
    if (inventory.fallen_signage_count > 0) {
        const p = inventory.fallen_signage_count * 5;
        score -= p;
        penalties.push(`-${p}p: ${inventory.fallen_signage_count} afișe căzute/strâmbe`);
    }

    // --- FINALIZARE ---
    score = Math.max(0, Math.round(score)); // Nu scădem sub 0

    let grade = "Excelent";
    let color = "text-green-400";

    if (score < 95) { grade = "Foarte Bun"; color = "text-green-400"; }
    if (score < 85) { grade = "Bun"; color = "text-yellow-400"; }
    if (score < 70) { grade = "Mediu"; color = "text-orange-400"; }
    if (score < 50) { grade = "Slab"; color = "text-red-500"; }

    return {
        finalScore: score,
        grade,
        penalties,
        color
    };
};