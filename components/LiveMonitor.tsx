import { useRef, useEffect, useState, useCallback } from 'react';
import type { ZoneType, WorkspaceViolation, CalculatedScore, ComplianceReport } from '../types';
import { useMediaPipeDetection, type TrackedObject } from '../hooks/useMediaPipeDetection';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// ─── Constants ────────────────────────────────────────────────────────────────

// Auto-scan eliminat (la cerere apasare buton)

const OBJECT_COLORS: Record<string, string> = {
    person: '#06b6d4',
    'cell phone': '#f43f5e',
    laptop: '#8b5cf6',
    tv: '#8b5cf6',
    keyboard: '#8b5cf6',
    mouse: '#8b5cf6',
    bottle: '#f59e0b',
    cup: '#f59e0b',
    bowl: '#f59e0b',
    'wine glass': '#f59e0b',
    book: '#ec4899',
    backpack: '#ec4899',
    handbag: '#ec4899',
    suitcase: '#ec4899',
    scissors: '#f97316',
    clock: '#94a3b8',
};

const SEVERITY_COLORS: Record<string, string> = {
    'CRITICĂ': '#ef4444',
    'Mare': '#f97316',
    'Medie': '#eab308',
    'Mică': '#3b82f6',
};

const SEVERITY_BG: Record<string, string> = {
    'CRITICĂ': 'rgba(239, 68, 68, 0.15)',
    'Mare': 'rgba(249, 115, 22, 0.15)',
    'Medie': 'rgba(234, 179, 8, 0.15)',
    'Mică': 'rgba(59, 130, 246, 0.15)',
};

const SEVERITY_ICONS: Record<string, string> = {
    'CRITICĂ': '🔴',
    'Mare': '🟠',
    'Medie': '🟡',
    'Mică': '🔵',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface VideoRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

function computeVideoRect(video: HTMLVideoElement): VideoRect {
    if (!video.videoWidth || !video.videoHeight) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    const nativeAspect = video.videoWidth / video.videoHeight;
    const elW = video.offsetWidth;
    const elH = video.offsetHeight;
    const elAspect = elW / elH;
    if (nativeAspect > elAspect) {
        const h = elW / nativeAspect;
        return { x: 0, y: (elH - h) / 2, width: elW, height: h };
    }
    const w = elH * nativeAspect;
    return { x: (elW - w) / 2, y: 0, width: w, height: elH };
}

function getScoreColor(s: number): string {
    if (s >= 95) return '#22c55e';
    if (s >= 75) return '#eab308';
    return '#ef4444';
}

function getScoreBg(s: number): string {
    if (s >= 95) return 'rgba(34, 197, 94, 0.15)';
    if (s >= 75) return 'rgba(234, 179, 8, 0.15)';
    return 'rgba(239, 68, 68, 0.15)';
}

function getObjectColor(label: string): string {
    return OBJECT_COLORS[label.toLowerCase()] ?? '#94a3b8';
}

// ─── CV Tracked Object Box (real-time, smooth) ───────────────────────────────

interface CVBoxProps {
    obj: TrackedObject;
    vr: VideoRect;
}

function CVBox({ obj, vr }: CVBoxProps) {
    const bx = obj.bbox.x * vr.width;
    const by = obj.bbox.y * vr.height;
    const bw = obj.bbox.width * vr.width;
    const bh = obj.bbox.height * vr.height;

    const color = getObjectColor(obj.label);
    const opacity = Math.min(1, obj.confidence) * (obj.framesMissing > 0 ? 0.6 : 1);
    const strokeW = 3.5;
    const arm = Math.max(Math.min(bw, bh) * 0.25, 10);
    const labelText = `${obj.label} ${Math.round(obj.confidence * 100)}%`;
    const labelW = labelText.length * 7.5 + 16;
    const labelH = 24;
    const labelY = by > 28 ? by - 28 : by + bh + 4;

    return (
        <g opacity={opacity} style={{ transition: 'opacity 0.3s' }}>
            {/* Visible fill */}
            <rect x={bx} y={by} width={bw} height={bh} fill={color} opacity={0.10} rx={4} />

            {/* Full border — thin continuous outline for shape clarity */}
            <rect x={bx} y={by} width={bw} height={bh} fill="none" stroke={color} strokeWidth={1.5} rx={4} opacity={0.35} />

            {/* Corner brackets — thick and bold */}
            <path d={`M${bx},${by + arm} L${bx},${by} L${bx + arm},${by}`}
                fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
            <path d={`M${bx + bw - arm},${by} L${bx + bw},${by} L${bx + bw},${by + arm}`}
                fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
            <path d={`M${bx},${by + bh - arm} L${bx},${by + bh} L${bx + arm},${by + bh}`}
                fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
            <path d={`M${bx + bw - arm},${by + bh} L${bx + bw},${by + bh} L${bx + bw},${by + bh - arm}`}
                fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />

            {/* Label pill */}
            <rect x={bx} y={labelY} width={labelW} height={labelH} rx={4} fill={color} opacity={0.92} />
            <text x={bx + 8} y={labelY + 17} fill="white" fontSize="13" fontFamily="Inter, sans-serif" fontWeight="700">
                {labelText}
            </text>
        </g>
    );
}

// ─── Gemini violation overlay (persistent between scans) ─────────────────────

interface ViolationOverlayProps {
    violation: WorkspaceViolation;
    vr: VideoRect;
}

function ViolationOverlay({ violation, vr }: ViolationOverlayProps) {
    if (!violation.boundingBox) return null;

    const { x: nx, y: ny, width: nw, height: nh } = violation.boundingBox;
    const bx = nx * vr.width;
    const by = ny * vr.height;
    const bw = nw * vr.width;
    const bh = nh * vr.height;

    const color = SEVERITY_COLORS[violation.severity] ?? '#eab308';

    return (
        <g>
            <rect x={bx} y={by} width={bw} height={bh} fill={color} opacity={0.12} />
            <rect x={bx} y={by} width={bw} height={bh} fill="none" stroke={color} strokeWidth={2} rx={4}
                strokeDasharray="6 3" opacity={0.7} />
        </g>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LiveMonitorProps {
    zoneType: ZoneType;
    onChangeZone: (zone: ZoneType) => void;
}

function LiveMonitor({ zoneType, onChangeZone }: LiveMonitorProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isMountedRef = useRef(true);

    const [isStreaming, setIsStreaming] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [videoRect, setVideoRect] = useState<VideoRect>({ x: 0, y: 0, width: 0, height: 0 });

    const [score, setScore] = useState<CalculatedScore | null>(null);
    const [violations, setViolations] = useState<WorkspaceViolation[]>([]);
    const [recommendations, setRecommendations] = useState<string[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanCount, setScanCount] = useState(0);
    const [lastError, setLastError] = useState<string | null>(null);
    const [showViolationPanel, setShowViolationPanel] = useState(false);

    // ── MediaPipe real-time detection ──────────────────────────────────────
    const { trackedObjects, isModelLoading, fps, modelError } = useMediaPipeDetection(videoRef, {
        enabled: isStreaming,
        minConfidence: 0.40,
        targetFps: 15,
    });

    // ── Camera startup ─────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                });
                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                const video = videoRef.current;
                if (video) {
                    video.srcObject = stream;
                    await video.play();
                }
                setIsStreaming(true);
            } catch (err) {
                if (!cancelled) {
                    setCameraError(err instanceof Error ? err.message : 'Eroare cameră');
                }
            }
        };

        startCamera();

        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // ── Track rendered video rect ──────────────────────────────────────────
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isStreaming) return;

        const update = () => { setVideoRect(computeVideoRect(video)); };

        const observer = new ResizeObserver(update);
        observer.observe(video);
        video.addEventListener('loadedmetadata', update);

        const poll = setInterval(update, 500);
        const stopPoll = setTimeout(() => clearInterval(poll), 4000);

        return () => {
            observer.disconnect();
            video.removeEventListener('loadedmetadata', update);
            clearInterval(poll);
            clearTimeout(stopPoll);
        };
    }, [isStreaming]);

    // ── Unmount tracking ────────────────────────────────────────────────────
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // ── Build detected objects summary for Gemini context ──────────────────
    const buildDetectedObjectsSummary = useCallback((): string => {
        // Only include actively visible objects — exclude ghosts persisted after disappearance
        const activeObjects = trackedObjects.filter((obj) => obj.framesMissing === 0);
        if (activeObjects.length === 0) return '';
        const items = activeObjects.map(
            (obj) => `- ${obj.label} (${Math.round(obj.confidence * 100)}%) la coordonate [${obj.bbox.x.toFixed(2)}, ${obj.bbox.y.toFixed(2)}, ${obj.bbox.width.toFixed(2)}, ${obj.bbox.height.toFixed(2)}]`
        );
        return `\n\n## OBIECTE DETECTATE AUTOMAT (Computer Vision - EfficientDet):\n${items.join('\n')}\nFolosește aceste detecții ca referință pentru localizarea obiectelor.`;
    }, [trackedObjects]);

    // ── Backend compliance scan (hybrid: CV objects + image) ────────────────
    const captureAndAnalyze = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !video.videoWidth) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';

        setIsScanning(true);
        setLastError(null);

        const cvContext = buildDetectedObjectsSummary();

        try {
            const res = await fetch(`${BACKEND_URL}/api/v1/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64, zoneType, cvContext: cvContext || undefined }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Eroare server' }));
                throw new Error(err.detail ?? `HTTP ${res.status}`);
            }

            const result: ComplianceReport = await res.json();

            if (!isMountedRef.current) return;

            setScore(result.computation);
            setViolations(result.violations);
            setRecommendations(result.recommendations);
            setScanCount(prev => prev + 1);

            if (result.violations.length > 0) {
                setShowViolationPanel(true);
            }
        } catch {
            if (!isMountedRef.current) return;
            setLastError('Eroare la scanare. Se reîncearcă...');
        } finally {
            if (isMountedRef.current) {
                setIsScanning(false);
            }
        }
    }, [zoneType, buildDetectedObjectsSummary]);

    const captureRef = useRef(captureAndAnalyze);
    captureRef.current = captureAndAnalyze;

    // Auto-scan Gemini a fost eliminat pentru control complet manual din UX.

    // ── Reset on zone change ───────────────────────────────────────────────
    useEffect(() => {
        setViolations([]);
        setRecommendations([]);
        setScore(null);
        setScanCount(0);
        setLastError(null);
        setShowViolationPanel(false);
    }, [zoneType]);

    const vr = videoRect;
    const hasVideo = vr.width > 0 && vr.height > 0;
    const violationCount = violations.length;
    const objectCount = trackedObjects.length;

    return (
        <div className="fixed inset-0 bg-black flex flex-col">
            {/* ═══ CAMERA FEED AREA ═══ */}
            <div className="relative flex-1 min-h-0">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Camera error */}
                {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
                        <div className="text-center p-8">
                            <p className="text-red-400 text-lg font-bold mb-2">Eroare cameră</p>
                            <p className="text-white/50 text-sm">{cameraError}</p>
                        </div>
                    </div>
                )}

                {/* ── SVG overlay: CV tracked objects (real-time) + Gemini violations ── */}
                {hasVideo && (
                    <svg
                        className="absolute pointer-events-none z-30"
                        style={{ left: vr.x, top: vr.y }}
                        width={vr.width}
                        height={vr.height}
                        viewBox={`0 0 ${vr.width} ${vr.height}`}
                    >
                        {/* Real-time CV boxes (smooth, tracked) */}
                        {trackedObjects.map((obj) => (
                            <CVBox key={obj.id} obj={obj} vr={vr} />
                        ))}

                        {/* Gemini compliance violations (dashed, persistent) */}
                        {violations.map((v, i) => (
                            <ViolationOverlay key={`v-${i}`} violation={v} vr={vr} />
                        ))}
                    </svg>
                )}

                {/* ── TOP BAR: Score + Zone + Status ── */}
                {hasVideo && (
                    <div
                        className="absolute top-0 left-0 right-0 z-40 pointer-events-none"
                        style={{ paddingLeft: Math.max(vr.x, 8), paddingRight: Math.max(vr.x, 8) }}
                    >
                        <div className="flex items-start justify-between pt-3 px-1">
                            {/* Score badge */}
                            <div className="pointer-events-auto">
                                {score ? (
                                    <div
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-md"
                                        style={{
                                            background: getScoreBg(score.finalScore),
                                            border: `1px solid ${getScoreColor(score.finalScore)}40`,
                                        }}
                                    >
                                        <span
                                            className="text-3xl font-bold font-mono transition-all duration-700"
                                            style={{ color: getScoreColor(score.finalScore) }}
                                        >
                                            {score.finalScore}
                                        </span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-white/40">/100</span>
                                            <span
                                                className="text-xs font-semibold"
                                                style={{ color: getScoreColor(score.finalScore) }}
                                            >
                                                {score.grade}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                                        <span className="text-3xl font-bold font-mono text-white/20">--</span>
                                        <span className="text-xs text-white/30">
                                            {isModelLoading ? 'Model CV...' : isScanning ? 'Scanare...' : 'Asteptare...'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Zone toggle + status */}
                            <div className="flex flex-col items-end gap-2 pointer-events-auto">
                                {/* Zone toggle */}
                                <div className="flex rounded-lg overflow-hidden bg-black/60 backdrop-blur-md border border-white/10">
                                    <button
                                        onClick={() => onChangeZone('casierie')}
                                        className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                                            zoneType === 'casierie'
                                                ? 'bg-cyan-500/25 text-cyan-300'
                                                : 'text-white/40 hover:text-white/70'
                                        }`}
                                    >
                                        Casierie
                                    </button>
                                    <button
                                        onClick={() => onChangeZone('birou_consilier')}
                                        className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                                            zoneType === 'birou_consilier'
                                                ? 'bg-cyan-500/25 text-cyan-300'
                                                : 'text-white/40 hover:text-white/70'
                                        }`}
                                    >
                                        Consilier
                                    </button>
                                </div>

                                {/* Status row: CV + Gemini */}
                                <div className="flex items-center gap-1.5">
                                    {/* CV status */}
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                                        {isModelLoading ? (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                                <span className="text-[10px] text-violet-300">CV...</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                                <span className="text-[10px] text-cyan-300 font-mono">{objectCount} obj</span>
                                                {fps > 0 && (
                                                    <span className="text-[10px] text-white/30 font-mono">{fps}fps</span>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Gemini status */}
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                                        {isScanning ? (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                <span className="text-[10px] text-amber-300">Scanare AI...</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                <span className="text-[10px] text-green-400">AI Pregătit</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SCAN NOW button ── */}
                {hasVideo && !isScanning && (
                    <button
                        onClick={() => { captureRef.current().catch(() => {}); }}
                        className="absolute z-40 bottom-4 left-1/2 -translate-x-1/2
                                   flex items-center gap-2 px-5 py-2.5 rounded-full
                                   bg-cyan-500/20 backdrop-blur-md border border-cyan-400/30
                                   text-cyan-300 text-sm font-semibold
                                   active:scale-95 transition-transform"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="4" />
                        </svg>
                        Scanează Acum
                    </button>
                )}

                {/* Scanning overlay */}
                {isScanning && hasVideo && (
                    <div
                        className="absolute z-30 pointer-events-none"
                        style={{ left: vr.x, top: vr.y, width: vr.width, height: vr.height }}
                    >
                        <div className="absolute inset-0 border-2 border-cyan-400/30 rounded-lg animate-pulse" />
                        <div className="scan-beam" />
                    </div>
                )}

                {/* Error toasts */}
                {(lastError || modelError) && (
                    <div className="absolute bottom-16 left-3 right-3 z-50">
                        <div className="bg-red-900/80 backdrop-blur-md rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/30">
                            <span className="font-bold text-red-400">Eroare: </span>
                            {(lastError ?? modelError ?? '').substring(0, 100)}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ BOTTOM PANEL: Violations ═══ */}
            <div className={`bg-[#0c1324] border-t border-white/10 transition-all duration-300 overflow-hidden ${
                showViolationPanel && (violationCount > 0 || recommendations.length > 0) ? 'max-h-[40vh]' : 'max-h-14'
            }`}>
                <button
                    onClick={() => setShowViolationPanel(prev => !prev)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                    <div className="flex items-center gap-3">
                        {violationCount > 0 ? (
                            <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                                    {violationCount}
                                </span>
                                <span className="text-sm text-white/80 font-medium">
                                    {violationCount === 1 ? 'Problemă detectată' : 'Probleme detectate'}
                                </span>
                            </div>
                        ) : scanCount > 0 ? (
                            <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs">
                                    ✓
                                </span>
                                <span className="text-sm text-green-400/80 font-medium">Totul în regulă</span>
                            </div>
                        ) : (
                            <span className="text-sm text-white/40">
                                {isModelLoading ? 'Se încarcă modelul CV...' : 'Se inițializează...'}
                            </span>
                        )}
                    </div>

                    {(violationCount > 0 || recommendations.length > 0) && (
                        <svg
                            className={`w-4 h-4 text-white/40 transition-transform ${showViolationPanel ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                    )}
                </button>

                {showViolationPanel && (violationCount > 0 || recommendations.length > 0) && (
                    <div className="overflow-y-auto px-3 pb-3 space-y-2" style={{ maxHeight: 'calc(40vh - 48px)' }}>
                        {violations.map((v, i) => {
                            const color = SEVERITY_COLORS[v.severity] ?? '#eab308';
                            const bg = SEVERITY_BG[v.severity] ?? 'rgba(234, 179, 8, 0.15)';
                            const icon = SEVERITY_ICONS[v.severity] ?? '🟡';
                            return (
                                <div
                                    key={`v-${i}`}
                                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl border"
                                    style={{ background: bg, borderColor: `${color}30` }}
                                >
                                    <span className="text-base mt-0.5">{icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white/90 leading-snug">{v.description}</p>
                                        <span className="text-[11px] font-medium mt-0.5 inline-block" style={{ color }}>
                                            {v.severity}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {recommendations.length > 0 && (
                            <div className="mt-2 px-3 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/20">
                                <p className="text-[11px] text-cyan-400 font-semibold mb-1.5 uppercase tracking-wider">Recomandări</p>
                                {recommendations.map((rec) => (
                                    <p key={rec} className="text-sm text-white/70 leading-snug mb-1 last:mb-0">
                                        • {rec}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LiveMonitor;
