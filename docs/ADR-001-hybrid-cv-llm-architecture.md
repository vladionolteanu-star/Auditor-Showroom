# ADR-001: Hybrid CV + LLM Architecture for Showroom Compliance Monitoring

## Status

Accepted (Phase 1 implemented)

## Date

2026-04-14

## Context

### Problem Statement

The Visual Showroom Auditor ("Ochiul Soacrei") monitors cashier desks and advisor offices for compliance via camera. The original architecture used Gemini Pro as a single monolithic AI call that performed both object detection (returning bounding boxes) and compliance reasoning.

This caused three UX problems:

1. **No real-time feedback.** Bounding boxes updated only every 30 seconds (scan interval + 3-8s API latency). Between scans, the user saw a raw camera feed with no visual intelligence.
2. **Unstable bounding boxes.** The LLM approximated coordinates differently each call, causing boxes to jump position even when objects had not moved.
3. **Client-side API key exposure.** The Gemini API key is embedded in the frontend via `VITE_GEMINI_API_KEY`.

### Current Architecture (Before)

```
[Camera getUserMedia] → [Canvas base64 JPEG]
                             ↓
                   [Gemini Pro (client-side)]
                   - Object detection (bboxes)
                   - Compliance reasoning
                   - disorder_score, flags, recommendations
                             ↓
                   [aiValidator → scoringEngine]
                             ↓
                   [SVG overlay on <video>]
```

## Decision

Adopt a **Hybrid Architecture** that separates deterministic computer vision (object detection) from LLM reasoning (compliance evaluation).

```
Phase 1: CAPTURE
  [Camera getUserMedia] → [Video frames at 15 FPS]

Phase 2: DETERMINISTIC CV (client-side, every frame)
  [MediaPipe EfficientDet-Lite0] → Raw detections
  [IoU Tracker + EMA Smoother] → Stable tracked objects

Phase 3: LLM REASONING (every 30s, using CV output as context)
  [Gemini Pro] receives:
    - Detected objects list (from Phase 2)
    - Zone policies (casierie / birou_consilier)
    - Single frame snapshot
  Returns:
    - disorder_score (0-10)
    - compliance flags
    - recommendations

Phase 4: RENDER
  [CV bounding boxes] → Real-time SVG overlay (smooth, 15 FPS)
  [LLM compliance score] → Score badge + violation panel (updates every 30s)
```

### Temporal Tracking (IoU-Based)

Raw per-frame detections flicker. The tracker implements:

1. **IoU matching** -- Match current-frame detections to previous tracks (threshold 0.25)
2. **Appearance debounce** -- Detection must appear in 2+ consecutive frames before shown
3. **Disappearance persistence** -- Track persists 8 frames after last detection
4. **Position smoothing** -- EMA (alpha=0.35) on bounding box coordinates
5. **Confidence smoothing** -- EMA on confidence scores

## Implementation Phases

### Phase 1: Client-Side MediaPipe (DONE)

Real-time bounding boxes at 15 FPS, no backend changes.

Files:
- `hooks/useMediaPipeDetection.ts` -- MediaPipe + tracker hook
- `components/LiveMonitor.tsx` -- Dual overlay (CV boxes + Gemini violations)
- `services/geminiService.ts` -- Accepts CV context as parameter

### Phase 2: Proxy Backend for API Key Security (Next)

Move Gemini API key server-side via Vercel Edge/Serverless Functions.

### Phase 3: Server-Side YOLO for Enhanced Detection (Future)

Fine-tune YOLOv8 on annotated showroom images. Deploy on FastAPI (Cloud Run).

### Phase 4: Multi-Camera Dashboard (Future)

Central monitoring of multiple zones. Requires WebSocket hub + PostgreSQL.

## Trade-Off Analysis

### CV Model Selection

| Criteria | MediaPipe EfficientDet | YOLO via ONNX Web | Cloud Vision API |
|----------|----------------------|-------------------|-----------------|
| Latency | 30-60ms (client GPU) | 50-100ms (client) | 500-2000ms (network) |
| FPS | 15-30 | 10-20 | <1 |
| Bundle | ~8 MB lazy | ~15-25 MB | 0 (API call) |
| Offline | Yes | Yes | No |
| Mobile | Good (WebGL) | Moderate (WASM) | N/A |
| Cost | Free | Free | $1.50/1K images |

**Decision:** MediaPipe for Phase 1. YOLO server-side for Phase 3.

### Future Backend Language

| Criteria | Node.js (Fastify) | Python (FastAPI) |
|----------|-------------------|-----------------|
| CV ecosystem | Weak | Dominant (PyTorch, ultralytics, supervision) |
| Model serving | Difficult | Native |
| Code sharing | TypeScript shared | Separate types (Pydantic) |
| Fine-tuning YOLO | Not practical | 3 lines of code |

**Decision:** Python/FastAPI when backend is needed (Phase 3). CV ecosystem advantage is decisive.

## Consequences

### Positive

1. **Real-time UX** -- 15 FPS bounding boxes, "security camera with AI" feel
2. **Separation of concerns** -- CV handles geometry, LLM handles semantics
3. **Deterministic bounding boxes** -- Same object = same box every frame
4. **Temporal stability** -- IoU tracking + EMA eliminates flickering
5. **No infrastructure change** -- Phase 1 runs entirely on Vercel
6. **Graceful degradation** -- Falls back to LLM-only if MediaPipe fails

### Negative

1. **Bundle size** -- ~8 MB for MediaPipe WASM + model (lazy loaded)
2. **Battery drain** -- Running CV at 15 FPS on mobile
3. **Generic model** -- EfficientDet trained on COCO (80 classes), cannot distinguish "scattered receipts" from "organized documents" -- LLM compensates via frame snapshot
4. **Two inference systems** -- MediaPipe + Gemini increases complexity

## References

- [MediaPipe Object Detection Web](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector/web_js)
- [SORT: Simple Online and Realtime Tracking](https://arxiv.org/abs/1602.00763)
- [YOLOv8 Ultralytics](https://docs.ultralytics.com/)
