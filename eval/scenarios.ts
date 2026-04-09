/**
 * Eval Scenarios for Prompt Testing
 *
 * Each scenario defines:
 * - A description of what a "photo" shows (used as text input to Gemini)
 * - Expected inventory ranges
 * - Whether specific flags should be true/false
 * - Whether violations should or should NOT be generated (false positive check)
 */

export interface ExpectedInventory {
    disorder_score_min: number;
    disorder_score_max: number;
    has_personal_items: boolean;
    has_document_clutter: boolean;
    has_clear_workspace: boolean;
}

export interface EvalScenario {
    id: string;
    name: string;
    zoneType: 'casierie' | 'birou_consilier';
    /** Text description sent to Gemini as if it were an image */
    sceneDescription: string;
    expected: ExpectedInventory;
    /** Min/max number of violations expected */
    violations_min: number;
    violations_max: number;
    /** If true, this tests that normal items are NOT flagged */
    isFalsePositiveTest: boolean;
}

// ============================================================
// FALSE POSITIVE TESTS — Normal scenes that should score WELL
// ============================================================

export const FALSE_POSITIVE_SCENARIOS: EvalScenario[] = [
    {
        id: 'fp-casierie-clean',
        name: 'Casierie perfectă — doar echipament standard',
        zoneType: 'casierie',
        sceneDescription: `Tejghea de casierie curată și ordonată.
Pe tejghea se află: terminal POS, scanner de coduri de bare, imprimantă de bonuri.
Tastatura și mouse-ul sunt pe zona lor dedicată.
Ecranul monitorului afișează interfața de vânzare.
Sub tejghea sunt pungi noi pentru clienți, aranjate.
Lângă casă, pe un raft, sunt produse de impuls (gumă, baterii, ciocolată).
Un flyer promoțional este fixat pe suportul dedicat.
Nu există obiecte personale, hârtii libere sau dezordine.`,
        expected: {
            disorder_score_min: 0,
            disorder_score_max: 1,
            has_personal_items: false,
            has_document_clutter: false,
            has_clear_workspace: true,
        },
        violations_min: 0,
        violations_max: 0,
        isFalsePositiveTest: true,
    },
    {
        id: 'fp-birou-clean',
        name: 'Birou consilier perfect — doar echipament standard',
        zoneType: 'birou_consilier',
        sceneDescription: `Birou de consilier curat și organizat.
Pe birou: laptop deschis, tastatură externă, mouse pe mousepad.
Un telefon fix de birou în stânga.
Un dosar de prezentare deschis (dosarul activ curent).
Cataloage de produse aranjate vertical în suport.
Un pahar de apă curat pe un coaster.
Scaunul clientului este liber și curat.
Lampă de birou aprinsă.
Cablurile sunt organizate cu clipsuri sub birou, invizibile.
Nu sunt obiecte personale, hârtii risipite sau dezordine.`,
        expected: {
            disorder_score_min: 0,
            disorder_score_max: 1,
            has_personal_items: false,
            has_document_clutter: false,
            has_clear_workspace: true,
        },
        violations_min: 0,
        violations_max: 0,
        isFalsePositiveTest: true,
    },
    {
        id: 'fp-casierie-promo',
        name: 'Casierie cu materiale promoționale (nu e dezordine)',
        zoneType: 'casierie',
        sceneDescription: `Tejghea de casierie.
Echipament standard: POS, scanner, monitor, imprimantă bonuri.
Pe un suport dedicat: flyere promoționale pentru campania de sezon.
Lângă casă: raft cu produse de impuls (gumă, baterii, ciocolată).
Pungi noi pentru clienți în suportul dedicat sub tejghea.
Un pix în suportul de pixuri.
Totul aranjat, curat, fără obiecte personale.`,
        expected: {
            disorder_score_min: 0,
            disorder_score_max: 1,
            has_personal_items: false,
            has_document_clutter: false,
            has_clear_workspace: true,
        },
        violations_min: 0,
        violations_max: 0,
        isFalsePositiveTest: true,
    },
];

// ============================================================
// TRUE POSITIVE TESTS — Messy scenes that MUST be detected
// ============================================================

export const TRUE_POSITIVE_SCENARIOS: EvalScenario[] = [
    {
        id: 'tp-casierie-phone',
        name: 'Casierie cu telefon personal pe tejghea',
        zoneType: 'casierie',
        sceneDescription: `Tejghea de casierie.
Echipament standard: POS, scanner, monitor.
Dar: un telefon mobil personal (smartphone negru) se află pe tejghea, lângă POS, cu ecranul aprins.
Restul tejghelei este ordonat.`,
        expected: {
            disorder_score_min: 2,
            disorder_score_max: 4,
            has_personal_items: true,
            has_document_clutter: false,
            has_clear_workspace: true,
        },
        violations_min: 1,
        violations_max: 2,
        isFalsePositiveTest: false,
    },
    {
        id: 'tp-casierie-documents',
        name: 'Casierie cu documente risipite',
        zoneType: 'casierie',
        sceneDescription: `Tejghea de casierie.
Echipament standard prezent.
Pe tejghea: 5-6 bonuri/chitanțe risipite, neordonate.
2 dosare deschise cu hârtii ieșind din ele.
O listă de verificare printată, nefixată, lângă scanner.
Nu sunt obiecte personale.`,
        expected: {
            disorder_score_min: 3,
            disorder_score_max: 6,
            has_personal_items: false,
            has_document_clutter: true,
            has_clear_workspace: true,
        },
        violations_min: 2,
        violations_max: 5,
        isFalsePositiveTest: false,
    },
    {
        id: 'tp-birou-messy',
        name: 'Birou consilier foarte dezordonat',
        zoneType: 'birou_consilier',
        sceneDescription: `Birou de consilier dezordonat.
Laptop deschis, dar pe birou mai sunt:
- Telefon mobil personal cu ecranul aprins
- O sticlă de Cola pe jumătate băută
- 3 dosare deschise cu hârtii risipite
- O geantă personală pe scaunul clientului
- 5-6 post-it-uri lipite haotic pe monitor
- Cabluri vizibile și încurcate
- 2 pixuri libere pe birou (nu în suport)
- Un pachet de șervețele pe birou
Biroul e ocupat cam 70%.`,
        expected: {
            disorder_score_min: 7,
            disorder_score_max: 10,
            has_personal_items: true,
            has_document_clutter: true,
            has_clear_workspace: false,
        },
        violations_min: 5,
        violations_max: 12,
        isFalsePositiveTest: false,
    },
    {
        id: 'tp-casierie-small-objects',
        name: 'Casierie cu obiecte mici (test sensibilitate)',
        zoneType: 'casierie',
        sceneDescription: `Tejghea de casierie, echipament standard prezent.
Dezordine ușoară dar vizibilă:
- 2 pixuri libere pe tejghea (nu în suport)
- 3 monede risipite lângă POS
- Un capac de pix pe tejghea
- O agrafă de hârtie lângă scanner
- Un bon vechi mototoloit la marginea tejghelei
Tejghea e 85% liberă, dar obiectele mici sunt vizibile.`,
        expected: {
            disorder_score_min: 2,
            disorder_score_max: 4,
            has_personal_items: false,
            has_document_clutter: true,
            has_clear_workspace: true,
        },
        violations_min: 3,
        violations_max: 6,
        isFalsePositiveTest: false,
    },
    {
        id: 'tp-birou-subtle',
        name: 'Birou consilier cu dezordine subtilă',
        zoneType: 'birou_consilier',
        sceneDescription: `Birou de consilier aparent ordonat, dar cu probleme subtile:
- Laptop, tastatură, mouse — OK
- DAR: telefonul personal e parțial ascuns sub un dosar
- 2 hârtii libere pe birou (nu în dosar)
- Un pahar de cafea gol (deja băut) lângă monitor
- 4 post-it-uri lipite pe marginea monitorului
- Un pix liber pe birou
Biroul e 80% liber, dar dezordinea subtilă e vizibilă.`,
        expected: {
            disorder_score_min: 3,
            disorder_score_max: 5,
            has_personal_items: true,
            has_document_clutter: true,
            has_clear_workspace: true,
        },
        violations_min: 3,
        violations_max: 7,
        isFalsePositiveTest: false,
    },
];

export const ALL_SCENARIOS: EvalScenario[] = [
    ...FALSE_POSITIVE_SCENARIOS,
    ...TRUE_POSITIVE_SCENARIOS,
];
