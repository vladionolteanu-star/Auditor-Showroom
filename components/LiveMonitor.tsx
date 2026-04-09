import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ZoneType, WorkspaceViolation, CalculatedScore } from '../types';
import { getVisualAudit } from '../services/geminiService';
import { useObjectDetection } from '../hooks/useObjectDetection';

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_INTERVAL_MS = 30_000;
const GEMINI_INITIAL_DELAY_MS = 5_000;
const VIOLATION_VISIBLE_MS = 10_000;

const OBJECT_COLORS: Record<string, string> = {
    person: '#06b6d4',
    'cell phone': '#8b5cf6',
    laptop: '#8b5cf6',
    tv: '#8b5cf6',
    keyboard: '#8b5cf6',
    mouse: '#8b5cf6',
    bottle: '#f59e0b',
    cup: '#f59e0b',
    bowl: '#f59e0b',
    'wine glass': '#f59e0b',
    fork: '#f59e0b',
    knife: '#f59e0b',
    spoon: '#f59e0b',
    backpack: '#ec4899',
    handbag: '#ec4899',
    suitcase: '#ec4899',
};

const SEVERITY_COLORS: Record<string, string> = {
    'CRITICĂ': '#ef4444',
    'Mare': '#ec4899',
    'Medie': '#eab308',
    'Mică': '#3b82f6',
};

function getObjectColor(cls: string): string {
    return OBJECT_COLORS[cls.toLowerCase()] ?? '#94a3b8';
}

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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TFBoxProps {
    cls: string;
    score: number;
    bbox: [number, number, number, number];
    videoNaturalW: number;
    videoNaturalH: number;
    vr: VideoRect;
}

const TFBox: React.FC<TFBoxProps> = ({ cls, score, bbox, videoNaturalW, videoNaturalH, vr }) => {
    if (!videoNaturalW || !videoNaturalH) return null;

    const scaleX = vr.width / videoNaturalW;
    const scaleY = vr.height / videoNaturalH;

    const rx = bbox[0] * scaleX;
    const ry = bbox[1] * scaleY;
    const rw = bbox[2] * scaleX;
    const rh = bbox[3] * scaleY;

    const color = getObjectColor(cls);
    const arm = Math.max(Math.min(rw, rh) * 0.18, 7);
    const labelText = `${cls} ${Math.round(score * 100)}%`;
    const labelW = labelText.length * 6.2 + 14;
    const labelY = ry > 24 ? ry - 24 : ry + rh + 4;

    return (
        <g>
            {/* Dim fill */}
            <rect x={rx} y={ry} width={rw} height={rh} fill={color} opacity={0.08} />

            {/* Corner brackets — top-left */}
            <path
                d={`M${rx},${ry + arm} L${rx},${ry} L${rx + arm},${ry}`}
                fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"
            />
            {/* top-right */}
            <path
                d={`M${rx + rw - arm},${ry} L${rx + rw},${ry} L${rx + rw},${ry + arm}`}
                fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"
            />
            {/* bottom-left */}
            <path
                d={`M${rx},${ry + rh - arm} L${rx},${ry + rh} L${rx + arm},${ry + rh}`}
                fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"
            />
            {/* bottom-right */}
            <path
                d={`M${rx + rw - arm},${ry + rh} L${rx + rw},${ry + rh} L${rx + rw},${ry + rh - arm}`}
                fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"
            />

            {/* Label */}
            <rect x={rx} y={labelY} width={labelW} height={20} rx={3} fill={color} opacity={0.85} />
            <text
                x={rx + 7} y={labelY + 14}
                fill="white" fontSize="10" fontFamily="Inter, ui-sans-serif, sans-serif" fontWeight="600"
            >
                {labelText}
            </text>
        </g>
    );
};

interface ViolationBoxProps {
    violation: WorkspaceViolation;
    vr: VideoRect;
    opacity: number;
}

const ViolationBox: React.FC<ViolationBoxProps> = ({ violation, vr, opacity }) => {
    if (!violation.boundingBox) return null;

    const { x: nx, y: ny, width: nw, height: nh } = violation.boundingBox;
    const bx = nx * vr.width;
    const by = ny * vr.height;
    const bw = nw * vr.width;
    const bh = nh * vr.height;

    const color = SEVERITY_COLORS[violation.severity] ?? '#eab308';
    const label = violation.description.length > 30
        ? violation.description.substring(0, 30) + '…'
        : violation.description;
    const labelW = label.length * 6.5 + 16;
    const labelY = by > 28 ? by - 28 : by + bh + 4;

    return (
        <g opacity={opacity}>
            <rect x={bx} y={by} width={bw} height={bh} fill={color} opacity={0.18} />
            <rect x={bx} y={by} width={bw} height={bh} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray="6 3" opacity={0.9} />
            <rect x={bx} y={labelY} width={labelW} height={22} rx={4} fill={color} opacity={0.92} />
            <text x={bx + 8} y={labelY + 15} fill="white" fontSize="11" fontFamily="Inter, ui-sans-serif, sans-serif" fontWeight="700">
                {label}
            </text>
        </g>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface LiveMonitorProps {
    zoneType: ZoneType;
    onChangeZone: (zone: ZoneType) => void;
}

const LiveMonitor: React.FC<LiveMonitorProps> = ({ zoneType, onChangeZone }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const geminiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const violationFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isStreaming, setIsStreaming] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [videoRect, setVideoRect] = useState<VideoRect>({ x: 0, y: 0, width: 0, height: 0 });
    const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

    const [score, setScore] = useState<CalculatedScore | null>(null);
    const [violations, setViolations] = useState<WorkspaceViolation[]>([]);
    const [violationOpacity, setViolationOpacity] = useState(0);
    const [isGeminiScanning, setIsGeminiScanning] = useState(false);
    const [geminiCountdown, setGeminiCountdown] = useState<number | null>(null);
    const [scanCount, setScanCount] = useState(0);
    const [lastGeminiError, setLastGeminiError] = useState<string | null>(null);

    // ── TF.js object detection ─────────────────────────────────────────────
    const { detections, isModelLoading, fps } = useObjectDetection(videoRef, {
        enabled: isStreaming,
        minScore: 0.45,
        targetFps: 12,
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

    // ── Track rendered video rect (letterbox-aware) ────────────────────────
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isStreaming) return;

        const update = () => {
            const rect = computeVideoRect(video);
            setVideoRect(rect);
            if (video.videoWidth && video.videoHeight) {
                setNaturalSize({ w: video.videoWidth, h: video.videoHeight });
            }
        };

        const observer = new ResizeObserver(update);
        observer.observe(video);
        video.addEventListener('loadedmetadata', update);
        video.addEventListener('resize', update);

        // Poll briefly after load to catch initial dimensions
        const poll = setInterval(update, 250);
        const stopPoll = setTimeout(() => clearInterval(poll), 4000);

        return () => {
            observer.disconnect();
            video.removeEventListener('loadedmetadata', update);
            video.removeEventListener('resize', update);
            clearInterval(poll);
            clearTimeout(stopPoll);
        };
    }, [isStreaming]);

    // ── Gemini compliance scan ─────────────────────────────────────────────
    const captureAndAnalyze = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !video.videoWidth) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

        setIsGeminiScanning(true);
        setGeminiCountdown(null);
        setLastGeminiError(null);

        try {
            const { result } = await getVisualAudit(base64, 'image/jpeg', zoneType);

            setScore(result.computation);
            setViolations(result.violations);
            setScanCount(prev => prev + 1);

            // Show violation overlays for 10 seconds then fade
            setViolationOpacity(1);
            if (violationFadeTimerRef.current) clearTimeout(violationFadeTimerRef.current);
            violationFadeTimerRef.current = setTimeout(() => {
                setViolationOpacity(0);
            }, VIOLATION_VISIBLE_MS);
        } catch (err) {
            setLastGeminiError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsGeminiScanning(false);
        }
    }, [zoneType]);

    const captureRef = useRef(captureAndAnalyze);
    captureRef.current = captureAndAnalyze;

    // ── Gemini periodic loop ───────────────────────────────────────────────
    useEffect(() => {
        if (!isStreaming) return;

        let active = true;
        let countdownInterval: ReturnType<typeof setInterval> | null = null;

        const scheduleNext = (delayMs: number) => {
            let remaining = Math.ceil(delayMs / 1000);
            setGeminiCountdown(remaining);

            countdownInterval = setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    if (countdownInterval) clearInterval(countdownInterval);
                    setGeminiCountdown(null);
                } else {
                    setGeminiCountdown(remaining);
                }
            }, 1000);

            geminiTimerRef.current = setTimeout(async () => {
                if (countdownInterval) clearInterval(countdownInterval);
                if (!active) return;
                await captureRef.current();
                if (active) scheduleNext(GEMINI_INTERVAL_MS);
            }, delayMs);
        };

        scheduleNext(GEMINI_INITIAL_DELAY_MS);

        return () => {
            active = false;
            if (geminiTimerRef.current) clearTimeout(geminiTimerRef.current);
            if (countdownInterval) clearInterval(countdownInterval);
        };
    }, [isStreaming]);

    // ── Reset on zone change ───────────────────────────────────────────────
    useEffect(() => {
        setViolations([]);
        setScore(null);
        setScanCount(0);
        setViolationOpacity(0);
        setLastGeminiError(null);
    }, [zoneType]);

    // ── Cleanup violation fade timer on unmount ────────────────────────────
    useEffect(() => {
        return () => {
            if (violationFadeTimerRef.current) clearTimeout(violationFadeTimerRef.current);
        };
    }, []);

    const vr = videoRect;
    const hasVideoContent = vr.width > 0 && vr.height > 0;

    return (
        <div className="fixed inset-0 bg-black overflow-hidden">
            {/* Video layer */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera error state */}
            {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
                    <div className="text-center p-8">
                        <p className="text-red-400 text-lg font-bold mb-2">Eroare cameră</p>
                        <p className="text-white/50 text-sm">{cameraError}</p>
                    </div>
                </div>
            )}

            {hasVideoContent && (
                <>
                    {/* Scanning beam */}
                    <div
                        className="absolute pointer-events-none z-20 overflow-hidden"
                        style={{ left: vr.x, top: vr.y, width: vr.width, height: vr.height }}
                    >
                        <div className="scan-beam" />
                    </div>

                    {/* Corner targeting marks */}
                    <div className="absolute w-8 h-8 border-t-2 border-l-2 border-cyan-400/50 pointer-events-none z-20"
                        style={{ left: vr.x + 8, top: vr.y + 8 }} />
                    <div className="absolute w-8 h-8 border-t-2 border-r-2 border-cyan-400/50 pointer-events-none z-20"
                        style={{ left: vr.x + vr.width - 40, top: vr.y + 8 }} />
                    <div className="absolute w-8 h-8 border-b-2 border-l-2 border-cyan-400/50 pointer-events-none z-20"
                        style={{ left: vr.x + 8, top: vr.y + vr.height - 40 }} />
                    <div className="absolute w-8 h-8 border-b-2 border-r-2 border-cyan-400/50 pointer-events-none z-20"
                        style={{ left: vr.x + vr.width - 40, top: vr.y + vr.height - 40 }} />

                    {/* ── SVG overlay: TF.js real-time detections ── */}
                    <svg
                        className="absolute pointer-events-none z-30"
                        style={{ left: vr.x, top: vr.y }}
                        width={vr.width}
                        height={vr.height}
                        viewBox={`0 0 ${vr.width} ${vr.height}`}
                    >
                        {detections.map((det, i) => (
                            <TFBox
                                key={i}
                                cls={det.class}
                                score={det.score}
                                bbox={det.bbox}
                                videoNaturalW={naturalSize.w}
                                videoNaturalH={naturalSize.h}
                                vr={vr}
                            />
                        ))}

                        {/* ── Gemini violation overlays (fade after 10s) ── */}
                        {violations.map((v, i) => (
                            <ViolationBox
                                key={`v-${i}`}
                                violation={v}
                                vr={vr}
                                opacity={violationOpacity}
                            />
                        ))}
                    </svg>

                    {/* ── HUD layer ── */}
                    <div
                        className="absolute pointer-events-none z-50"
                        style={{ left: vr.x, top: vr.y, width: vr.width, height: vr.height }}
                    >
                        {/* Top-left: LIVE + zone toggles + FPS + model loading */}
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-auto">
                            <div className="flex items-center gap-2">
                                {/* LIVE badge */}
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">LIVE</span>
                                </div>

                                {/* Zone toggles */}
                                <div className="flex rounded-md overflow-hidden bg-black/70 backdrop-blur-sm">
                                    <button
                                        onClick={() => onChangeZone('casierie')}
                                        className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                                            zoneType === 'casierie'
                                                ? 'bg-cyan-500/30 text-cyan-300'
                                                : 'text-white/40 hover:text-white/70'
                                        }`}
                                    >
                                        Casierie
                                    </button>
                                    <button
                                        onClick={() => onChangeZone('birou_consilier')}
                                        className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                                            zoneType === 'birou_consilier'
                                                ? 'bg-cyan-500/30 text-cyan-300'
                                                : 'text-white/40 hover:text-white/70'
                                        }`}
                                    >
                                        Consilier
                                    </button>
                                </div>
                            </div>

                            {/* FPS counter */}
                            <div className="flex items-center gap-2">
                                <div className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                                    <span className="text-[10px] font-mono text-cyan-400">
                                        {fps > 0 ? `${fps} FPS` : '-- FPS'}
                                    </span>
                                </div>

                                {/* Model loading indicator */}
                                {isModelLoading && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                        <span className="text-[10px] text-violet-300">TF.js loading…</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top-right: Compliance score badge */}
                        {score && (
                            <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur-sm">
                                <span className={`text-2xl font-bold font-mono ${
                                    score.finalScore >= 95 ? 'text-green-400'
                                    : score.finalScore >= 75 ? 'text-yellow-400'
                                    : 'text-red-500'
                                }`}>
                                    {score.finalScore}
                                </span>
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] text-white/40">/100</span>
                                    <span className={`text-[10px] font-semibold ${
                                        score.finalScore >= 95 ? 'text-green-400'
                                        : score.finalScore >= 75 ? 'text-yellow-400'
                                        : 'text-red-500'
                                    }`}>
                                        {score.grade}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Gemini error toast */}
                        {lastGeminiError && (
                            <div className="absolute top-14 left-3 right-3 pointer-events-auto">
                                <div className="bg-red-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-[11px] text-red-300 break-all">
                                    <span className="font-bold text-red-400">ERR: </span>
                                    {lastGeminiError}
                                </div>
                            </div>
                        )}

                        {/* Bottom-left: detection count + Gemini status */}
                        <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
                            {/* Object detection count */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur-sm">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    isModelLoading ? 'bg-violet-400 animate-pulse' : 'bg-cyan-400'
                                }`} />
                                <span className="text-[11px] text-white/70">
                                    {isModelLoading
                                        ? 'Incarcare model…'
                                        : `${detections.length} obiecte detectate`}
                                </span>
                            </div>

                            {/* Gemini scan status */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur-sm">
                                {isGeminiScanning ? (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                        <span className="text-[11px] text-amber-300">Scanare conformitate…</span>
                                    </>
                                ) : geminiCountdown !== null ? (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                                        <span className="text-[11px] text-white/40 font-mono">
                                            Scan in {geminiCountdown}s…
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                        <span className="text-[11px] text-white/30">Asteptare cameră…</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Bottom-right: scan counter */}
                        <div className="absolute bottom-3 right-3">
                            <span className="text-[10px] font-mono text-white/30 bg-black/50 backdrop-blur-sm px-2 py-1 rounded">
                                SCAN #{scanCount}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default LiveMonitor;
