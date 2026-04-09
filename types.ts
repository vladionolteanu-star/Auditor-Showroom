export type ZoneType = 'casierie' | 'birou_consilier';

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface WorkspaceViolation {
    description: string;
    boundingBox?: BoundingBox;
    severity: 'CRITICĂ' | 'Mare' | 'Medie' | 'Mică';
}

export interface WorkspaceInventory {
    disorder_score: number;        // 0-10 (0=perfect, 10=haos)
    has_personal_items: boolean;   // telefon, mâncare, genți
    has_document_clutter: boolean; // documente risipite
    has_clear_workspace: boolean;  // suprafață de lucru liberă
}

export interface CalculatedScore {
    finalScore: number;
    grade: string;
    penalties: string[];
    color: string;
}

export interface ComplianceReport {
    isValid: boolean;
    zoneType: ZoneType;
    inventory: WorkspaceInventory;
    violations: WorkspaceViolation[];
    computation: CalculatedScore;
    recommendations: string[];
}

export interface AnalysisSnapshot {
    id: string;
    timestamp: string;
    frameUrl: string;
    report: ComplianceReport | { isValid: false; error: string };
}
