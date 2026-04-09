import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface ObjectDetection {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

interface UseObjectDetectionOptions {
  enabled?: boolean;
  minScore?: number;
  targetFps?: number;
}

interface UseObjectDetectionResult {
  detections: ObjectDetection[];
  isModelLoading: boolean;
  fps: number;
}

const FPS_EMA_ALPHA = 0.1;
const VIDEO_READY_STATE_HAVE_CURRENT_DATA = 2;

let sharedModel: cocoSsd.ObjectDetection | null = null;
let modelLoadPromise: Promise<cocoSsd.ObjectDetection> | null = null;

async function loadSharedModel(): Promise<cocoSsd.ObjectDetection> {
  if (sharedModel !== null) {
    return sharedModel;
  }

  if (modelLoadPromise !== null) {
    return modelLoadPromise;
  }

  modelLoadPromise = (async () => {
    await tf.ready();
    const model = await cocoSsd.load();
    sharedModel = model;
    return model;
  })();

  return modelLoadPromise;
}

export function useObjectDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options?: UseObjectDetectionOptions
): UseObjectDetectionResult {
  const enabled = options?.enabled ?? true;
  const minScore = options?.minScore ?? 0.5;
  const targetFps = options?.targetFps ?? 12;

  const [detections, setDetections] = useState<ObjectDetection[]>([]);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [fps, setFps] = useState(0);

  const rafIdRef = useRef<number | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const emaFpsRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  const frameIntervalMs = 1000 / targetFps;

  const stopLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const runDetection = useCallback(async (now: number) => {
    if (!isMountedRef.current || modelRef.current === null) {
      return;
    }

    const video = videoRef.current;
    if (
      video === null ||
      video.readyState < VIDEO_READY_STATE_HAVE_CURRENT_DATA ||
      video.paused ||
      video.ended
    ) {
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
      const rawDetections = await modelRef.current.detect(video);

      if (!isMountedRef.current) {
        return;
      }

      const filtered: ObjectDetection[] = rawDetections
        .filter((d) => d.score >= minScore)
        .map((d) => ({
          class: d.class,
          score: d.score,
          bbox: d.bbox as [number, number, number, number],
        }));

      setDetections(filtered);
      setFps(Math.round(emaFpsRef.current));
    } catch {
      // Detection errors are non-fatal; continue the loop
    }

    if (isMountedRef.current) {
      rafIdRef.current = requestAnimationFrame(runDetection);
    }
  }, [videoRef, minScore, frameIntervalMs]);

  useEffect(() => {
    isMountedRef.current = true;

    setIsModelLoading(true);

    loadSharedModel()
      .then((model) => {
        if (!isMountedRef.current) {
          return;
        }
        modelRef.current = model;
        setIsModelLoading(false);
      })
      .catch(() => {
        if (isMountedRef.current) {
          setIsModelLoading(false);
        }
      });

    return () => {
      isMountedRef.current = false;
      stopLoop();
    };
  }, [stopLoop]);

  useEffect(() => {
    if (isModelLoading) {
      return;
    }

    if (!enabled) {
      stopLoop();
      return;
    }

    lastFrameTimeRef.current = 0;
    rafIdRef.current = requestAnimationFrame(runDetection);

    return () => {
      stopLoop();
    };
  }, [enabled, isModelLoading, runDetection, stopLoop]);

  return { detections, isModelLoading, fps };
}
