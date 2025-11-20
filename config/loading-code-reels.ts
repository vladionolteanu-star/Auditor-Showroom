
export const PROJECT_FILES = [
  {
    path: "services/prompt.ts",
    language: "typescript",
    content: `// --- CATALOG DE DEFECTE (Sursa Adevărului) ---
// FOCUS: Curățenie, Ordine, Merchandising - Criterii CLARE și MĂSURABILE
const DEFECT_CATALOG = \`
1. CURĂȚENIE & SIGURANȚĂ (ZERO TOLERANCE):
   - Logistică vizibilă: Cutii carton, paleți, folii plastic, cărucioare marfă în zona clienți
   - Pericole: Cabluri pe jos, lichide vărsate, sticle/pahare abandonate
   - Gunoi vizibil: Hârtii pe jos, ambalaje, resturi alimentare
   - Praf gros: Straturi VIZIBILE de praf pe suprafețe lucioase (mese, rafturi)

2. ORDINE & PREZENTARE MOBILIER:
   - Produse deteriorate: Zgârieturi VIZIBILE, pete, rupturi
   - Neglijență: Sertare/uși lăsate deschise fără motiv (nu expoziție intenționată)
   - Scaune nealiniate: La mese, scaunele trebuie trase uniform

3. MERCHANDISING & RAFTURI:
   - Goluri în raft: Spații goale VIZIBILE unde ar trebui să fie produse
   - Produse nealiniate: Nu sunt trase la "buza" raftului (față)
   - Mix haotic: Produse DIFERITE amestecate fără logică (ex: vaze + prosoape)
   - Produse căzute: Articole răsturnate sau în dezordine pe raft

4. ZONE OPERAȚIONALE:
   - Clutter casierie: Hârtii personale, doze, geci, genți pe blat
   - Scaun netras: Scaunul nu e sub birou când nu e folosit
   - Etichete lipsă: Produse PRINCIPALE fără preț vizibil
   - Afișe căzute: Semnalistică strâmbă sau pe jos
\`;

export const buildAuditPrompt = (): string => {
  return \`
  Ești Auditor Senior Mobexpert. Sarcina ta este să NUMERI problemele VIZIBILE și CLARE.
  
  REGULI IMPORTANTE:
  - Numără DOAR probleme pe care le vezi CLAR în imagine
  - Dacă nu ești SIGUR, NU număra
  - Bounding box trebuie STRÂNS pe defect, nu zona largă
  - Fii CONSISTENT - aceeași problemă = același scor
  
  CATALOG STANDARDE:
  \${DEFECT_CATALOG}

  SEVERITATE:
  - CRITICĂ: Pericol siguranță sau logistică în zona clienți
  - Mare: Deteriorări produse, gunoi vizibil, praf gros
  - Medie: Dezordine, nealiniere, goluri în raft
  - Mică: Detalii estetice (afișe strâmbe, scaune nealiniate)

  FORMAT DE RĂSPUNS (JSON STRICT):
  {
    "_reasoning": "Analiză pas cu pas în română",
    "inventory": {
        "has_logistics_visible": boolean,
        "has_safety_hazards": boolean,
        "cleanliness_issues_count": number,
        "damaged_products_count": number,
        "open_drawers_doors_count": number,
        "shelf_voids_count": number,
        "disorganized_shelf_stock": boolean,
        "fallen_products_count": number,
        "checkout_clutter_detected": boolean,
        "missing_price_tags_count": number,
        "fallen_signage_count": number
    },
    "raw_deviations": [
        {
            "description": "Descriere PRECISĂ în română",
            "severity": "CRITICĂ" | "Mare" | "Medie" | "Mică",
            "boundingBox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 }
        }
    ],
    "recommendations": ["Acțiune specifică 1", "Acțiune specifică 2"]
  }
  \`;
};`
  },
  {
    path: "types.ts",
    language: "typescript",
    content: `export interface BoundingBox {
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

export interface AuditLog {
  id: string;
  timestamp: string;
  fileName: string;
  thoughtProcess: string;
  result: AuditReport | { isValid: false; error: string };
}`
  },
  {
    path: "App.tsx",
    language: "tsx",
    content: `const App: React.FC = () => {
  const handleRunAudit = async () => {
    setView('loading');
    try {
       // Call Gemini AI Vision Model
       const result = await getVisualAudit(image);
       setAuditLogs(prev => [result, ...prev]);
       setView('detail');
    } catch (error) {
       console.error("Audit failed", error);
    }
  };
  
  return (
    <div className="app-shell">
       <Header />
       <AuditResultDisplay />
    </div>
  );
};`
  }
];
