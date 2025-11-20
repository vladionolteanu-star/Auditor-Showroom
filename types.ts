export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface AIInventory {
    // --- 1. CURĂȚENIE & SIGURANȚĂ (Fundația Business) ---
    has_logistics_visible: boolean;      // Cutii, paleți, folii, cărucioare în zona clienți
    has_safety_hazards: boolean;         // Cabluri, lichide, sticle abandonate
    cleanliness_issues_count: number;    // Gunoi, praf vizibil gros, pete

    // --- 2. ORDINE & PREZENTARE MOBILIER ---
    damaged_products_count: number;      // Produse rupte/zgâriate VIZIBIL
    open_drawers_doors_count: number;    // Sertare/uși lăsate deschise (neglijență)

    // --- 3. MERCHANDISING & RAFTURI ---
    shelf_voids_count: number;           // Goluri în raft (lipsă marfă)
    disorganized_shelf_stock: boolean;   // Produse amestecate haotic, nealiniate
    fallen_products_count: number;       // Produse căzute/răsturnate pe raft

    // --- 4. ZONE OPERAȚIONALE ---
    checkout_clutter_detected: boolean;  // Hârtii, doze, haine pe desk

    // --- 5. PREȚURI & MARKETING ---
    missing_price_tags_count: number;    // Etichete lipsă
    fallen_signage_count: number;        // Panouri căzute/strâmbe
}

export interface CalculatedScore {
    finalScore: number;
    grade: string;
    penalties: string[];
    color: string;
}

export interface VisualDeviation {
    description: string;
    boundingBox?: BoundingBox;
    severity: 'CRITICĂ' | 'Mare' | 'Medie' | 'Mică';
}

export interface AuditReport {
    isValid: boolean;
    category: string;
    inventory: AIInventory;
    raw_deviations: VisualDeviation[];
    computation: CalculatedScore; // Calculat de noi, nu de AI
    recommendations: string[];
}

export interface Feedback {
    auditId: string;
    validation: 'correct' | 'incorrect';
    comment?: string;
    timestamp: string;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    fileName: string;
    previewUrl: string;
    thoughtProcess: string;
    result: AuditReport | { isValid: false; error: string };
}