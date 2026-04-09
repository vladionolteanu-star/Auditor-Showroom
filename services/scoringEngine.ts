import type { WorkspaceInventory, CalculatedScore } from '../types';

export const calculateScore = (inventory: WorkspaceInventory): CalculatedScore => {
    let score = 100;
    const penalties: string[] = [];

    // Dezordine generală: -8 puncte per nivel (0-10)
    if (inventory.disorder_score > 0) {
        const p = Math.round(inventory.disorder_score * 8);
        score -= p;
        penalties.push(`-${p}p: Dezordine nivel ${inventory.disorder_score}/10`);
    }

    // Obiecte personale pe spațiul de lucru
    if (inventory.has_personal_items) {
        score -= 15;
        penalties.push('-15p: Obiecte personale vizibile');
    }

    // Documente risipite
    if (inventory.has_document_clutter) {
        score -= 10;
        penalties.push('-10p: Documente dezordonate');
    }

    // Suprafață de lucru blocată
    if (!inventory.has_clear_workspace) {
        score -= 5;
        penalties.push('-5p: Suprafață de lucru aglomerată');
    }

    score = Math.max(0, Math.round(score));

    let grade = "Excelent";
    let color = "text-green-400";

    if (score < 95) { grade = "Bun"; color = "text-green-400"; }
    if (score < 75) { grade = "Necesită Atenție"; color = "text-yellow-400"; }
    if (score < 50) { grade = "Critic"; color = "text-red-500"; }

    return { finalScore: score, grade, penalties, color };
};
