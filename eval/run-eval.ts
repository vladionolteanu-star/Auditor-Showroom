/**
 * Eval Harness — Visual Showroom Auditor Prompt Evaluation
 *
 * Tests the full pipeline: prompt → Gemini API → validator → scoring
 * Checks for false positives and false negatives.
 *
 * Usage:
 *   npx tsx eval/run-eval.ts                    # Run all scenarios
 *   npx tsx eval/run-eval.ts --fp-only          # Only false positive tests
 *   npx tsx eval/run-eval.ts --tp-only          # Only true positive tests
 *   npx tsx eval/run-eval.ts --scenario tp-casierie-phone   # Single scenario
 *   npx tsx eval/run-eval.ts --dry-run          # Show scenarios without API calls
 *   npx tsx eval/run-eval.ts --scoring-only     # Test scoring engine offline (no API)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ALL_SCENARIOS, FALSE_POSITIVE_SCENARIOS, TRUE_POSITIVE_SCENARIOS } from './scenarios.js';
import type { EvalScenario, ExpectedInventory } from './scenarios.js';
import { buildAuditPrompt } from '../services/prompt.js';
import { calculateScore } from '../services/scoringEngine.js';
import { validateAIResponse, sanitizeAIResponse } from '../services/aiValidator.js';
import type { WorkspaceInventory, ZoneType } from '../types.js';

// ─── Config ──────────────────────────────────────────────────

const API_KEY = process.env.VITE_GEMINI_API_KEY || '';
const MODEL_NAME = 'gemini-pro-latest';
const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
const WARN = '⚠️  WARN';

// ─── Helpers ─────────────────────────────────────────────────

interface RawAIResponse {
    _reasoning?: string;
    inventory: WorkspaceInventory;
    raw_deviations: Array<{
        description: string;
        severity: string;
        boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
    recommendations: string[];
}

function extractJson(text: string): RawAIResponse | null {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '');
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last !== -1) {
        try {
            return JSON.parse(cleaned.substring(first, last + 1)) as RawAIResponse;
        } catch {
            return null;
        }
    }
    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Scoring Engine Tests (offline) ──────────────────────────

interface ScoringTestCase {
    name: string;
    inventory: WorkspaceInventory;
    expectedScoreMin: number;
    expectedScoreMax: number;
    expectedGrade: string;
}

const SCORING_TESTS: ScoringTestCase[] = [
    {
        name: 'Perfect workspace',
        inventory: { disorder_score: 0, has_personal_items: false, has_document_clutter: false, has_clear_workspace: true },
        expectedScoreMin: 100,
        expectedScoreMax: 100,
        expectedGrade: 'Excelent',
    },
    {
        name: 'Micro disorder only',
        inventory: { disorder_score: 1, has_personal_items: false, has_document_clutter: false, has_clear_workspace: true },
        expectedScoreMin: 90,
        expectedScoreMax: 95,
        expectedGrade: 'Bun',
    },
    {
        name: 'Personal items + light disorder',
        inventory: { disorder_score: 3, has_personal_items: true, has_document_clutter: false, has_clear_workspace: true },
        expectedScoreMin: 55,
        expectedScoreMax: 65,
        expectedGrade: 'Necesită Atenție',
    },
    {
        name: 'Heavy disorder',
        inventory: { disorder_score: 8, has_personal_items: true, has_document_clutter: true, has_clear_workspace: false },
        expectedScoreMin: 0,
        expectedScoreMax: 10,
        expectedGrade: 'Critic',
    },
    {
        name: 'Documents only',
        inventory: { disorder_score: 2, has_personal_items: false, has_document_clutter: true, has_clear_workspace: true },
        expectedScoreMin: 70,
        expectedScoreMax: 80,
        expectedGrade: 'Necesită Atenție',
    },
];

function runScoringTests(): { passed: number; failed: number } {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   SCORING ENGINE TESTS (offline, no API)         ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    let passed = 0;
    let failed = 0;

    for (const tc of SCORING_TESTS) {
        const result = calculateScore(tc.inventory);
        const scoreOk = result.finalScore >= tc.expectedScoreMin && result.finalScore <= tc.expectedScoreMax;
        const gradeOk = result.grade === tc.expectedGrade;
        const status = scoreOk && gradeOk ? PASS : FAIL;

        if (scoreOk && gradeOk) {
            passed++;
        } else {
            failed++;
        }

        console.log(`${status} ${tc.name}`);
        console.log(`   Score: ${result.finalScore} (expected ${tc.expectedScoreMin}-${tc.expectedScoreMax})`);
        console.log(`   Grade: ${result.grade} (expected ${tc.expectedGrade})`);
        if (result.penalties.length > 0) {
            console.log(`   Penalties: ${result.penalties.join(', ')}`);
        }
        console.log('');
    }

    return { passed, failed };
}

// ─── Validator Tests (offline) ───────────────────────────────

function runValidatorTests(): { passed: number; failed: number } {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   VALIDATOR TESTS (offline, no API)              ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    let passed = 0;
    let failed = 0;

    // Valid response
    const valid = validateAIResponse({
        inventory: { disorder_score: 3, has_personal_items: true, has_document_clutter: false, has_clear_workspace: true },
        raw_deviations: [{ description: 'Telefon personal', severity: 'Mare', boundingBox: { x: 0.3, y: 0.5, width: 0.08, height: 0.05 } }],
        recommendations: ['Îndepărtați telefonul'],
    });
    console.log(`${valid.isValid ? PASS : FAIL} Valid response accepted`);
    valid.isValid ? passed++ : failed++;

    // Invalid disorder_score
    const invalidScore = validateAIResponse({
        inventory: { disorder_score: 15, has_personal_items: false, has_document_clutter: false, has_clear_workspace: true } as WorkspaceInventory,
        raw_deviations: [],
        recommendations: [],
    });
    console.log(`${!invalidScore.isValid ? PASS : FAIL} Invalid disorder_score (15) rejected`);
    !invalidScore.isValid ? passed++ : failed++;

    // Invalid bbox
    const invalidBbox = validateAIResponse({
        inventory: { disorder_score: 2, has_personal_items: false, has_document_clutter: false, has_clear_workspace: true },
        raw_deviations: [{ description: 'Test', severity: 'Mică', boundingBox: { x: 1.5, y: 0.3, width: 0.1, height: 0.1 } }],
        recommendations: [],
    });
    console.log(`${!invalidBbox.isValid ? PASS : FAIL} Invalid boundingBox (x=1.5) rejected`);
    !invalidBbox.isValid ? passed++ : failed++;

    // Sanitizer clamps values
    const sanitized = sanitizeAIResponse({
        inventory: { disorder_score: 12, has_personal_items: 1, has_document_clutter: 0, has_clear_workspace: null },
        raw_deviations: [{ description: 'Test', severity: 'Mică', boundingBox: { x: -0.1, y: 0.5, width: 0.1, height: 0.1 } }],
        recommendations: [],
    });
    const scoreClamp = sanitized.inventory.disorder_score === 10;
    const boolConvert = sanitized.inventory.has_personal_items === true;
    const bboxClamp = sanitized.raw_deviations[0].boundingBox.x === 0;
    console.log(`${scoreClamp ? PASS : FAIL} Sanitizer clamps disorder_score 12→10`);
    console.log(`${boolConvert ? PASS : FAIL} Sanitizer converts truthy→boolean`);
    console.log(`${bboxClamp ? PASS : FAIL} Sanitizer clamps negative bbox x→0`);
    scoreClamp ? passed++ : failed++;
    boolConvert ? passed++ : failed++;
    bboxClamp ? passed++ : failed++;

    console.log('');
    return { passed, failed };
}

// ─── Gemini API Eval (online) ────────────────────────────────

interface ScenarioResult {
    scenario: EvalScenario;
    passed: boolean;
    failures: string[];
    warnings: string[];
    raw?: RawAIResponse;
    error?: string;
}

async function evalScenario(
    genAI: GoogleGenerativeAI,
    scenario: EvalScenario,
): Promise<ScenarioResult> {
    const failures: string[] = [];
    const warnings: string[] = [];

    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { temperature: 0.1, topK: 1, topP: 0.1, candidateCount: 1 },
    });

    const prompt = buildAuditPrompt(scenario.zoneType);
    const scenePrompt = `
NOTĂ: Nu am o imagine reală. Analizează următoarea DESCRIERE TEXTUALĂ a scenei ca și cum ai vedea imaginea:

--- DESCRIERE SCENĂ ---
${scenario.sceneDescription}
--- END ---

Răspunde strict în formatul JSON cerut.
`;

    try {
        const result = await model.generateContent([prompt, scenePrompt]);
        const response = await result.response;
        const text = response.text();
        const raw = extractJson(text);

        if (!raw) {
            return { scenario, passed: false, failures: ['Failed to parse JSON from response'], warnings, error: text.substring(0, 200) };
        }

        const validation = validateAIResponse(raw);
        if (!validation.isValid) {
            failures.push(`Validation errors: ${validation.errors.join(', ')}`);
        }

        const sanitized = sanitizeAIResponse(raw);
        const inv = sanitized.inventory;
        const exp = scenario.expected;

        // Check disorder_score range
        if (inv.disorder_score < exp.disorder_score_min) {
            failures.push(`disorder_score ${inv.disorder_score} < expected min ${exp.disorder_score_min}`);
        }
        if (inv.disorder_score > exp.disorder_score_max) {
            failures.push(`disorder_score ${inv.disorder_score} > expected max ${exp.disorder_score_max}`);
        }

        // Check boolean flags
        if (inv.has_personal_items !== exp.has_personal_items) {
            failures.push(`has_personal_items: got ${inv.has_personal_items}, expected ${exp.has_personal_items}`);
        }
        if (inv.has_document_clutter !== exp.has_document_clutter) {
            failures.push(`has_document_clutter: got ${inv.has_document_clutter}, expected ${exp.has_document_clutter}`);
        }
        if (inv.has_clear_workspace !== exp.has_clear_workspace) {
            failures.push(`has_clear_workspace: got ${inv.has_clear_workspace}, expected ${exp.has_clear_workspace}`);
        }

        // Check violation count
        const vCount = sanitized.raw_deviations.length;
        if (vCount < scenario.violations_min) {
            failures.push(`violations count ${vCount} < expected min ${scenario.violations_min}`);
        }
        if (vCount > scenario.violations_max) {
            warnings.push(`violations count ${vCount} > expected max ${scenario.violations_max} (over-detection)`);
        }

        // Check bounding boxes exist for all violations
        for (let i = 0; i < sanitized.raw_deviations.length; i++) {
            const dev = sanitized.raw_deviations[i];
            if (!dev.boundingBox) {
                warnings.push(`Deviation ${i} "${dev.description}" missing boundingBox`);
            } else {
                const { x, y, width, height } = dev.boundingBox;
                if (width > 0.4 || height > 0.4) {
                    warnings.push(`Deviation ${i} bbox too large (${width.toFixed(2)}×${height.toFixed(2)})`);
                }
            }
        }

        // False positive specific check
        if (scenario.isFalsePositiveTest && vCount > 0) {
            failures.push(`FALSE POSITIVE: ${vCount} violations on a clean scene! Descriptions: ${sanitized.raw_deviations.map((d: { description: string }) => d.description).join('; ')}`);
        }

        // Scoring check
        const score = calculateScore(inv);
        if (scenario.isFalsePositiveTest && score.finalScore < 90) {
            failures.push(`FALSE POSITIVE: score ${score.finalScore} on clean scene (expected ≥90)`);
        }

        return {
            scenario,
            passed: failures.length === 0,
            failures,
            warnings,
            raw: sanitized as RawAIResponse,
        };

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { scenario, passed: false, failures: [`API error: ${msg}`], warnings };
    }
}

function printResult(r: ScenarioResult): void {
    const icon = r.passed ? PASS : FAIL;
    const tag = r.scenario.isFalsePositiveTest ? '[FP-TEST]' : '[TP-TEST]';
    console.log(`\n${icon} ${tag} ${r.scenario.name}`);
    console.log(`   ID: ${r.scenario.id} | Zone: ${r.scenario.zoneType}`);

    if (r.raw) {
        const inv = r.raw.inventory;
        const score = calculateScore(inv as WorkspaceInventory);
        console.log(`   disorder_score: ${inv.disorder_score} | score: ${score.finalScore}/100 (${score.grade})`);
        console.log(`   personal: ${inv.has_personal_items} | docs: ${inv.has_document_clutter} | clear: ${inv.has_clear_workspace}`);
        console.log(`   violations: ${r.raw.raw_deviations.length}`);
        for (const dev of r.raw.raw_deviations) {
            const bb = dev.boundingBox ? `[${dev.boundingBox.x.toFixed(2)},${dev.boundingBox.y.toFixed(2)} ${dev.boundingBox.width.toFixed(2)}×${dev.boundingBox.height.toFixed(2)}]` : '[no bbox]';
            console.log(`     • ${dev.severity}: ${dev.description} ${bb}`);
        }
    }

    for (const f of r.failures) {
        console.log(`   ${FAIL} ${f}`);
    }
    for (const w of r.warnings) {
        console.log(`   ${WARN} ${w}`);
    }
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const fpOnly = args.includes('--fp-only');
    const tpOnly = args.includes('--tp-only');
    const dryRun = args.includes('--dry-run');
    const scoringOnly = args.includes('--scoring-only');
    const scenarioFilter = args.find(a => a.startsWith('--scenario='))?.split('=')[1]
        || (args.includes('--scenario') ? args[args.indexOf('--scenario') + 1] : undefined);

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   Visual Showroom Auditor — Eval Harness         ║');
    console.log('╚══════════════════════════════════════════════════╝');

    // Always run offline tests
    const scoringResult = runScoringTests();
    const validatorResult = runValidatorTests();

    if (scoringOnly) {
        const total = scoringResult.passed + scoringResult.failed + validatorResult.passed + validatorResult.failed;
        const allPassed = scoringResult.failed + validatorResult.failed;
        console.log(`\n═══ OFFLINE RESULTS: ${scoringResult.passed + validatorResult.passed}/${total} passed, ${allPassed} failed ═══`);
        process.exit(allPassed > 0 ? 1 : 0);
    }

    // Online tests require API key
    if (!API_KEY) {
        console.log('\n⚠️  No VITE_GEMINI_API_KEY found. Set it to run API scenarios.');
        console.log('   Example: VITE_GEMINI_API_KEY=your_key npx tsx eval/run-eval.ts');
        process.exit(1);
    }

    // Select scenarios
    let scenarios: EvalScenario[];
    if (scenarioFilter) {
        scenarios = ALL_SCENARIOS.filter(s => s.id === scenarioFilter);
        if (scenarios.length === 0) {
            console.error(`\nScenario "${scenarioFilter}" not found. Available: ${ALL_SCENARIOS.map(s => s.id).join(', ')}`);
            process.exit(1);
        }
    } else if (fpOnly) {
        scenarios = FALSE_POSITIVE_SCENARIOS;
    } else if (tpOnly) {
        scenarios = TRUE_POSITIVE_SCENARIOS;
    } else {
        scenarios = ALL_SCENARIOS;
    }

    if (dryRun) {
        console.log('\n── DRY RUN — Showing scenarios without API calls ──\n');
        for (const s of scenarios) {
            const tag = s.isFalsePositiveTest ? '[FP]' : '[TP]';
            console.log(`${tag} ${s.id}: ${s.name}`);
            console.log(`   Zone: ${s.zoneType}`);
            console.log(`   Expected: disorder ${s.expected.disorder_score_min}-${s.expected.disorder_score_max}, violations ${s.violations_min}-${s.violations_max}`);
            console.log(`   Scene: ${s.sceneDescription.substring(0, 100)}...`);
            console.log('');
        }
        process.exit(0);
    }

    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║   GEMINI API TESTS (${scenarios.length} scenarios)${' '.repeat(Math.max(0, 18 - String(scenarios.length).length))}║`);
    console.log(`╚══════════════════════════════════════════════════╝`);

    const genAI = new GoogleGenerativeAI(API_KEY);
    const results: ScenarioResult[] = [];

    for (let i = 0; i < scenarios.length; i++) {
        const s = scenarios[i];
        console.log(`\n── Running ${i + 1}/${scenarios.length}: ${s.name}...`);

        const result = await evalScenario(genAI, s);
        results.push(result);
        printResult(result);

        // Rate limit: wait 2s between API calls
        if (i < scenarios.length - 1) {
            await sleep(2000);
        }
    }

    // ─── Summary ──────────────────────────────────────────────
    console.log('\n\n╔══════════════════════════════════════════════════╗');
    console.log('║                   SUMMARY                        ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    const fpResults = results.filter(r => r.scenario.isFalsePositiveTest);
    const tpResults = results.filter(r => !r.scenario.isFalsePositiveTest);

    const fpPassed = fpResults.filter(r => r.passed).length;
    const tpPassed = tpResults.filter(r => r.passed).length;
    const totalPassed = results.filter(r => r.passed).length;
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

    console.log(`  False Positive Tests: ${fpPassed}/${fpResults.length} passed`);
    console.log(`  True Positive Tests:  ${tpPassed}/${tpResults.length} passed`);
    console.log(`  Total:                ${totalPassed}/${results.length} passed`);
    console.log(`  Warnings:             ${totalWarnings}`);
    console.log('');

    // Offline test totals
    const offlinePassed = scoringResult.passed + validatorResult.passed;
    const offlineFailed = scoringResult.failed + validatorResult.failed;
    console.log(`  Offline Tests:        ${offlinePassed}/${offlinePassed + offlineFailed} passed`);

    const allPassed = totalPassed === results.length && offlineFailed === 0;
    console.log(`\n  ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);

    process.exit(allPassed ? 0 : 1);
}

main();
