import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';

// ─── Types (shared with useYoloDetection) ────────────────────────────────────

export interface TrackedObject {
    id: number;
    label: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
    framesVisible: number;
    framesMissing: number;
    isConfirmed: boolean;
}

interface RawDetection {
    label: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
}

interface UseYoloDetectionWsOptions {
    enabled?: boolean;
    minConfidence?: number;
}

interface UseDetectionResult {
    trackedObjects: TrackedObject[];
    isModelLoading: boolean;
    fps: number;
    modelError: string | null;
}

// ─── Tracker constants ───────────────────────────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const EMA_ALPHA = 0.35;
const CONFIRM_FRAMES = 2;
const PERSIST_FRAMES = 12;
const IOU_THRESHOLD = 0.25;
const WS_RECONNECT_MS = 2000;
const MAX_RECONNECTS = 5;

function computeIoU(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
): number {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);
    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    if (intersection === 0) return 0;
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    return intersection / (areaA + areaB - intersection);
}

function smoothBbox(
    prev: { x: number; y: number; width: number; height: number },
    next: { x: number; y: number; width: number; height: number },
) {
    return {
        x: EMA_ALPHA * next.x + (1 - EMA_ALPHA) * prev.x,
        y: EMA_ALPHA * next.y + (1 - EMA_ALPHA) * prev.y,
        width: EMA_ALPHA * next.width + (1 - EMA_ALPHA) * prev.width,
        height: EMA_ALPHA * next.height + (1 - EMA_ALPHA) * prev.height,
    };
}

function updateTracks(
    tracks: TrackedObject[],
    detections: RawDetection[],
    nextId: { value: number },
): TrackedObject[] {
    const used = new Set<number>();
    const updatedTracks: TrackedObject[] = [];

    for (const track of tracks) {
        let bestIdx = -1;
        let bestIoU = IOU_THRESHOLD;

        for (let i = 0; i < detections.length; i++) {
            if (used.has(i)) continue;
            if (detections[i].label !== track.label) continue;
            const iou = computeIoU(track.bbox, detections[i].bbox);
            if (iou > bestIoU) {
                bestIoU = iou;
                bestIdx = i;
            }
        }

        if (bestIdx >= 0) {
            used.add(bestIdx);
            const det = detections[bestIdx];
            updatedTracks.push({
                ...track,
                confidence: EMA_ALPHA * det.confidence + (1 - EMA_ALPHA) * track.confidence,
                bbox: smoothBbox(track.bbox, det.bbox),
                framesVisible: track.framesVisible + 1,
                framesMissing: 0,
                isConfirmed: track.framesVisible + 1 >= CONFIRM_FRAMES,
            });
        } else {
            const missing = track.framesMissing + 1;
            if (missing <= PERSIST_FRAMES) {
                updatedTracks.push({
                    ...track,
                    framesMissing: missing,
                    confidence: track.confidence * 0.95,
                });
            }
        }
    }

    for (let i = 0; i < detections.length; i++) {
        if (used.has(i)) continue;
        const det = detections[i];
        updatedTracks.push({
            id: nextId.value++,
            label: det.label,
            confidence: det.confidence,
            bbox: det.bbox,
            framesVisible: 1,
            framesMissing: 0,
            isConfirmed: false,
        });
    }

    return updatedTracks;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useYoloDetectionWs(
    videoRef: RefObject<HTMLVideoElement | null>,
    options?: UseYoloDetectionWsOptions,
): UseDetectionResult {
    const enabled = options?.enabled ?? true;

    const [trackedObjects, setTrackedObjects] = useState<TrackedObject[]>([]);
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [fps, setFps] = useState(0);
    const [modelError, setModelError] = useState<string | null>(null);

    const tracksRef = useRef<TrackedObject[]>([]);
    const nextIdRef = useRef({ value: 1 });
    const isMountedRef = useRef(true);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectsRef = useRef(0);
    const sendingRef = useRef(false);

    // Create off-screen canvas for frame capture
    useEffect(() => {
        canvasRef.current = document.createElement('canvas');
    }, []);

    // Capture and send one frame via WebSocket
    const sendFrame = useCallback(() => {
        if (!isMountedRef.current || !enabled || sendingRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ws = wsRef.current;
        if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return;
        if (video.readyState < 2 || !video.videoWidth) return;

        sendingRef.current = true;

        const scale = Math.min(640 / video.videoWidth, 640 / video.videoHeight);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { sendingRef.current = false; return; }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
            (blob) => {
                if (!blob || !isMountedRef.current) { sendingRef.current = false; return; }
                const ws = wsRef.current;
                if (!ws || ws.readyState !== WebSocket.OPEN) { sendingRef.current = false; return; }
                ws.send(blob);
            },
            'image/jpeg',
            0.6,
        );
    }, [enabled, videoRef]);

    // WebSocket lifecycle
    useEffect(() => {
        isMountedRef.current = true;

        if (!enabled) return;

        // Health check first
        setIsModelLoading(true);
        fetch(`${BACKEND_URL}/health`)
            .then(res => {
                if (!isMountedRef.current) return;
                if (!res.ok) {
                    setModelError('Backend indisponibil');
                    setIsModelLoading(false);
                    return;
                }
                setIsModelLoading(false);
                connectWs();
            })
            .catch(() => {
                if (!isMountedRef.current) return;
                setModelError('Backend indisponibil — pornește uvicorn');
                setIsModelLoading(false);
            });

        let frameStartTime = 0;

        function connectWs() {
            if (!isMountedRef.current) return;

            const wsUrl = BACKEND_URL.replace(/^http/, 'ws') + '/api/v1/ws/detect';
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.binaryType = 'arraybuffer';

            ws.onopen = () => {
                if (!isMountedRef.current) { ws.close(); return; }
                reconnectsRef.current = 0;
                setModelError(null);
                frameStartTime = performance.now();
                sendFrame();
            };

            ws.onmessage = (ev) => {
                if (!isMountedRef.current) return;
                sendingRef.current = false;

                try {
                    const data = JSON.parse(ev.data);
                    const rawDetections: RawDetection[] = data.objects.map((obj: any) => ({
                        label: obj.label,
                        confidence: obj.confidence,
                        bbox: { x: obj.x, y: obj.y, width: obj.width, height: obj.height },
                    }));

                    const updated = updateTracks(tracksRef.current, rawDetections, nextIdRef.current);
                    tracksRef.current = updated;
                    setTrackedObjects(updated.filter(t => t.isConfirmed));

                    const now = performance.now();
                    const elapsed = now - frameStartTime;
                    if (elapsed > 0) setFps(Math.round(1000 / elapsed));
                    frameStartTime = now;
                } catch {
                    // malformed message — skip
                }

                // Send next frame immediately (auto-pacing)
                if (isMountedRef.current && enabled) {
                    sendFrame();
                }
            };

            ws.onclose = () => {
                sendingRef.current = false;
                if (!isMountedRef.current) return;
                if (reconnectsRef.current < MAX_RECONNECTS) {
                    reconnectsRef.current++;
                    setTimeout(connectWs, WS_RECONNECT_MS);
                } else {
                    setModelError('WebSocket deconectat — reîncarcă pagina');
                }
            };

            ws.onerror = () => {
                // onclose will fire after onerror
            };
        }

        return () => {
            isMountedRef.current = false;
            sendingRef.current = false;
            const ws = wsRef.current;
            if (ws && ws.readyState <= WebSocket.OPEN) {
                ws.close();
            }
            wsRef.current = null;
        };
    }, [enabled, sendFrame]);

    return { trackedObjects, isModelLoading, fps, modelError };
}
