export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Deviation {
  category: string;
  severity: string;
  description: string;
  location: string;
  humanRule: string;
  baseImpact: number;
  zoneMultiplier: number;
  finalImpact: number;
  boundingBox?: BoundingBox;
}

export interface AuditReport {
  isValid: true;
  category: string;
  confidence: number;
  score: number;
  grade: string;
  conformityPoints: string[];
  deviationsFound: Deviation[];
  scoringBreakdown: string;
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