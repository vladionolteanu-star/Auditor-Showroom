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

interface UseMediaPipeDetectionOptions {
    enabled?: boolean;
    minConfidence?: number;
    targetFps?: number;
}

interface UseMediaPipeDetectionResult {
    trackedObjects: TrackedObject[];
    isModelLoading: boolean;
    fps: number;
    modelError: string | null;
}

// ─── Tracking constants ──────────────────────────────────────────────────────

const EMA_ALPHA = 0.35;
const CONFIRM_FRAMES = 2;
const PERSIST_FRAMES = 8;
const IOU_THRESHOLD = 0.25;
const FPS_EMA_ALPHA = 0.15;

// ─── IoU calculation ─────────────────────────────────────────────────────────

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

// ─── Smooth bbox with EMA ────────────────────────────────────────────────────

function smoothBbox(
    prev: { x: number; y: number; width: number; height: number },
    next: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
    return {
        x: EMA_ALPHA * next.x + (1 - EMA_ALPHA) * prev.x,
        y: EMA_ALPHA * next.y + (1 - EMA_ALPHA) * prev.y,
        width: EMA_ALPHA * next.width + (1 - EMA_ALPHA) * prev.width,
        height: EMA_ALPHA * next.height + (1 - EMA_ALPHA) * prev.height,
    };
}

// ─── Tracker: match detections to existing tracks ────────────────────────────

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
                    confidence: track.confidence * 0.92,
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

// ─── MediaPipe loader ────────────────────────────────────────────────────────

interface MPObjectDetector {
    detectForVideo(video: HTMLVideoElement, timestamp: number): {
        detections: Array<{
            boundingBox?: { originX: number; originY: number; width: number; height: number };
            categories: Array<{ categoryName: string; score: number }>;
        }>;
    };
    setOptions(options: { runningMode: string }): Promise<void>;
}

let sharedDetector: MPObjectDetector | null = null;
let detectorLoadPromise: Promise<MPObjectDetector> | null = null;

async function loadDetector(minConfidence: number): Promise<MPObjectDetector> {
    if (sharedDetector) return sharedDetector;
    if (detectorLoadPromise) return detectorLoadPromise;

    detectorLoadPromise = (async () => {
        const vision = await import('@mediapipe/tasks-vision');
        const { ObjectDetector, FilesetResolver } = vision;

        const wasmFileset = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const detector = await ObjectDetector.createFromOptions(wasmFileset, {
            baseOptions: {
                modelAssetPath:
                    'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
                delegate: 'GPU',
            },
            scoreThreshold: minConfidence,
            maxResults: 15,
            runningMode: 'VIDEO',
        });

        sharedDetector = detector as unknown as MPObjectDetector;
        return sharedDetector;
    })();

    return detectorLoadPromise;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMediaPipeDetection(
    videoRef: RefObject<HTMLVideoElement | null>,
    options?: UseMediaPipeDetectionOptions,
): UseMediaPipeDetectionResult {
    const enabled = options?.enabled ?? true;
    const minConfidence = options?.minConfidence ?? 0.40;
    const targetFps = options?.targetFps ?? 15;

    const [trackedObjects, setTrackedObjects] = useState<TrackedObject[]>([]);
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [fps, setFps] = useState(0);
    const [modelError, setModelError] = useState<string | null>(null);

    const detectorRef = useRef<MPObjectDetector | null>(null);
    const tracksRef = useRef<TrackedObject[]>([]);
    const nextIdRef = useRef({ value: 1 });
    const rafIdRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef(0);
    const emaFpsRef = useRef(0);
    const isMountedRef = useRef(true);

    const frameIntervalMs = 1000 / targetFps;

    const stopLoop = useCallback(() => {
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    }, []);

    const runDetection = useCallback(
        (now: number) => {
            if (!isMountedRef.current || !detectorRef.current) return;

            const video = videoRef.current;
            if (!video || video.readyState < 2 || video.paused || video.ended) {
                rafIdRef.current = requestAnimationFrame(runDetection);
                return;
            }

            const elapsed = now - lastFrameTimeRef.current;
            if (elapsed < frameIntervalMs) {
                rafIdRef.current = requestAnimationFrame(runDetection);
                return;
            }

            const instantFps = elapsed > 0 ? 1000 / elapsed : 0;
            emaFpsRef.current =
                emaFpsRef.current === 0
                    ? instantFps
                    : FPS_EMA_ALPHA * instantFps + (1 - FPS_EMA_ALPHA) * emaFpsRef.current;
            lastFrameTimeRef.current = now;

            try {
                const result = detectorRef.current.detectForVideo(video, now);

                const rawDetections: RawDetection[] = result.detections
                    .filter((d) => d.boundingBox && d.categories.length > 0)
                    .map((d) => {
                        const bb = d.boundingBox!;
                        const cat = d.categories[0];
                        return {
                            label: cat.categoryName,
                            confidence: cat.score,
                            bbox: {
                                x: bb.originX / video.videoWidth,
                                y: bb.originY / video.videoHeight,
                                width: bb.width / video.videoWidth,
                                height: bb.height / video.videoHeight,
                            },
                        };
                    });

                const updated = updateTracks(tracksRef.current, rawDetections, nextIdRef.current);
                tracksRef.current = updated;

                if (isMountedRef.current) {
                    setTrackedObjects(updated.filter((t) => t.isConfirmed));
                    setFps(Math.round(emaFpsRef.current));
                }
            } catch {
                // Non-fatal detection error — continue loop
            }

            if (isMountedRef.current) {
                rafIdRef.current = requestAnimationFrame(runDetection);
            }
        },
        [videoRef, frameIntervalMs],
    );

    // Load model
    useEffect(() => {
        isMountedRef.current = true;
        setIsModelLoading(true);
        setModelError(null);

        loadDetector(minConfidence)
            .then((detector) => {
                if (!isMountedRef.current) return;
                detectorRef.current = detector;
                setIsModelLoading(false);
            })
            .catch((err) => {
                if (!isMountedRef.current) return;
                setModelError(err instanceof Error ? err.message : 'Model load failed');
                setIsModelLoading(false);
            });

        return () => {
            isMountedRef.current = false;
            stopLoop();
        };
    }, [minConfidence, stopLoop]);

    // Detection loop
    useEffect(() => {
        if (isModelLoading || !enabled) {
            stopLoop();
            return;
        }

        lastFrameTimeRef.current = 0;
        rafIdRef.current = requestAnimationFrame(runDetection);

        return () => {
            stopLoop();
        };
    }, [enabled, isModelLoading, runDetection, stopLoop]);

    return { trackedObjects, isModelLoading, fps, modelError };
}
