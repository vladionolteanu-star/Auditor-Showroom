import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface UseYoloDetectionOptions {
    enabled?: boolean;
    minConfidence?: number;
    pollIntervalMs?: number;
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

export function useYoloDetection(
    videoRef: RefObject<HTMLVideoElement | null>,
    options?: UseYoloDetectionOptions,
): UseDetectionResult {
    const enabled = options?.enabled ?? true;
    const pollIntervalMs = options?.pollIntervalMs ?? 800;

    const [trackedObjects, setTrackedObjects] = useState<TrackedObject[]>([]);
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [fps, setFps] = useState(0);
    const [modelError, setModelError] = useState<string | null>(null);

    const tracksRef = useRef<TrackedObject[]>([]);
    const nextIdRef = useRef({ value: 1 });
    const isMountedRef = useRef(true);
    const isPollingRef = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastTimeRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Create off-screen canvas for frame capture
    useEffect(() => {
        const cvs = document.createElement('canvas');
        canvasRef.current = cvs;
    }, []);

    // Check backend health on mount
    useEffect(() => {
        isMountedRef.current = true;
        setIsModelLoading(true);

        fetch(`${BACKEND_URL}/health`)
            .then(res => {
                if (!isMountedRef.current) return;
                if (res.ok) {
                    setIsModelLoading(false);
                } else {
                    setModelError('Backend indisponibil');
                    setIsModelLoading(false);
                }
            })
            .catch(() => {
                if (!isMountedRef.current) return;
                setModelError('Backend indisponibil — pornește uvicorn');
                setIsModelLoading(false);
            });

        return () => { isMountedRef.current = false; };
    }, []);

    const pollDetection = useCallback(async () => {
        if (!isMountedRef.current || !enabled || isPollingRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2 || !video.videoWidth) {
            timerRef.current = setTimeout(pollDetection, pollIntervalMs);
            return;
        }

        isPollingRef.current = true;
        const startTime = performance.now();

        try {
            // Capture frame at reduced resolution for speed
            const scale = Math.min(640 / video.videoWidth, 640 / video.videoHeight);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1] ?? '';

            const res = await fetch(`${BACKEND_URL}/api/v1/detect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64 }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            if (!isMountedRef.current) return;

            const rawDetections: RawDetection[] = data.objects.map((obj: any) => ({
                label: obj.label,
                confidence: obj.confidence,
                bbox: { x: obj.x, y: obj.y, width: obj.width, height: obj.height },
            }));

            const updated = updateTracks(tracksRef.current, rawDetections, nextIdRef.current);
            tracksRef.current = updated;
            setTrackedObjects(updated.filter(t => t.isConfirmed));

            const elapsed = performance.now() - startTime;
            const currentFps = elapsed > 0 ? 1000 / elapsed : 0;
            setFps(Math.round(currentFps));
            setModelError(null);

        } catch {
            // Silent fail — retry next poll
        } finally {
            isPollingRef.current = false;
            if (isMountedRef.current && enabled) {
                timerRef.current = setTimeout(pollDetection, pollIntervalMs);
            }
        }
    }, [enabled, pollIntervalMs, videoRef]);

    // Start/stop polling loop
    useEffect(() => {
        if (!enabled || isModelLoading) {
            if (timerRef.current) clearTimeout(timerRef.current);
            return;
        }

        lastTimeRef.current = 0;
        timerRef.current = setTimeout(pollDetection, 500);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [enabled, isModelLoading, pollDetection]);

    return { trackedObjects, isModelLoading, fps, modelError };
}
