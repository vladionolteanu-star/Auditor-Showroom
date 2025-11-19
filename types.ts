// --- TIPURI PENTRU BOUNDING BOX ---
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// --- OUTPUT-UL FACTUAL AL AI-ULUI (FĂRĂ SCORURI) ---
export interface AIInventory {
    // 1. Logistică & Siguranță
    has_logistics_visible: boolean;      // Cutii, paleți pe jos
    has_safety_hazards: boolean;         // Cabluri, lichide, cioburi
    
    // 2. Integritate Produse
    damaged_products_count: number;      // Câte produse rupte/zgâriate sunt vizibile
    
    // 3. Merchandising & Prețuri
    missing_price_tags_count: number;    // Câte etichete lipsesc
    misaligned_products_count: number;   // Produse strâmbe (covor, tablou)
    
    // 4. Estetică
    poor_textile_styling: boolean;       // Perne turtite, pături aruncate
    orphan_products_count: number;       // Produse singure, fără context
    
    // 5. Calitate Imagine (Meta)
    image_clarity_score: number;         // 0-10 (cât de clar vede AI-ul)
}

// --- REZULTATUL FINAL CALCULAT DE COD (SCORING ENGINE) ---
export interface CalculatedScore {
    finalScore: number;       // 0-100
    grade: string;            // "Very Good", "Poor", etc.
    penalties: string[];      // Lista explicațiilor ("-5p: Cutie pe jos")
    color: string;            // Hex code pentru UI
}

// --- DEVIATII VIZUALE (PENTRU DESENAT PE POZĂ) ---
export interface VisualDeviation {
    description: string;
    boundingBox?: BoundingBox;
    severity: 'CRITICĂ' | 'Mare' | 'Medie' | 'Mică';
}

// --- RAPORTUL FINAL UNIFICAT ---
export interface AuditReport {
    isValid: boolean;
    category: string;
    
    // Date brute de la AI
    inventory: AIInventory;
    raw_deviations: VisualDeviation[];
    
    // Date calculate de noi (TypeScript)
    computation: CalculatedScore;
    
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