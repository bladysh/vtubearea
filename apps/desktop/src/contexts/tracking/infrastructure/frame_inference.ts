import { FaceLandmarker, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

/** Point pairs for drawing a face outline and hand skeletons. */
export const LANDMARK_CONNECTIONS = {
  face_contours: FaceLandmarker.FACE_LANDMARKS_CONTOURS,
  hand: HandLandmarker.HAND_CONNECTIONS,
} as const;
import type { FaceFrame } from "@vtubearea/protocol";
import { MediapipeFaceTracker, type CameraImage, type ConfidenceThresholds, type InferenceDelegate } from "./mediapipe_face_tracker";
import { box_around, type ImageBox } from "../domain/hand_appearance_gate";
import type { InferenceDevice } from "../domain/tracking_settings";
import { MediapipeHandTracker, type HandTrackingResult } from "./mediapipe_hand_tracker";

export interface InferenceOptions {
  wasm_url: string;
  face_model_url: string;
  hand_model_url: string;
  face_confidence: ConfidenceThresholds;
  hand_confidence: ConfidenceThresholds;
}

export interface FrameInferenceResult {
  face_frame: FaceFrame;
  face_landmarks: NormalizedLandmark[] | null;
  hand_landmarks: NormalizedLandmark[][];
  inference_ms: number;
}

/**
 * Face every frame, hands when enabled, on the main thread.
 * shortcut: a module Web Worker measured 4-8x slower in Chrome (MediaPipe loses its fast
 * path there); revisit if a MediaPipe update fixes worker performance.
 */
export class TrackerPair {
  private hand_tracker: MediapipeHandTracker | null = null;
  private is_hand_tracking_enabled = false;
  private frames_since_hands = Number.POSITIVE_INFINITY;
  private last_hand_result: HandTrackingResult | null = null;
  /** Hands run on every n-th camera frame; between runs the last hands are kept. */
  hand_frame_interval = 1;

  private constructor(
    private readonly face_tracker: MediapipeFaceTracker,
    private readonly options: InferenceOptions,
    private readonly device: InferenceDevice,
  ) {}

  static async create(options: InferenceOptions, device: InferenceDevice): Promise<TrackerPair> {
    const face_tracker = await MediapipeFaceTracker.create({
      wasm_path: options.wasm_url,
      model_path: options.face_model_url,
      use_gpu: device !== "cpu",
      confidence: options.face_confidence,
    });
    return new TrackerPair(face_tracker, options, device);
  }

  get delegate(): InferenceDelegate {
    return this.face_tracker.delegate;
  }

  async set_hand_tracking_enabled(is_enabled: boolean): Promise<void> {
    this.is_hand_tracking_enabled = is_enabled;
    this.last_hand_result = null;
    if (!is_enabled || this.hand_tracker) return;
    this.hand_tracker = await MediapipeHandTracker.create({
      wasm_path: this.options.wasm_url,
      model_path: this.options.hand_model_url,
      use_gpu: this.device === "gpu",
      confidence: this.options.hand_confidence,
    });
  }

  run(camera_image: CameraImage, timestamp_ms: number): FrameInferenceResult {
    const started_ms = performance.now();
    const face_result = this.face_tracker.track(camera_image, timestamp_ms);
    const face_box = face_result.landmarks ? box_around(face_result.landmarks) : null;
    const hand_result = this.track_hands(camera_image, timestamp_ms, face_box);
    return {
      face_frame: hand_result ? { ...face_result.face_frame, hands: hand_result.hands } : face_result.face_frame,
      face_landmarks: face_result.landmarks,
      hand_landmarks: hand_result?.landmarks ?? [],
      inference_ms: performance.now() - started_ms,
    };
  }

  /** Hands cost more than the face (MediaPipe looks for new palms on every frame), so they skip frames. */
  private track_hands(camera_image: CameraImage, timestamp_ms: number, face_box: ImageBox | null): HandTrackingResult | null {
    if (!this.is_hand_tracking_enabled || !this.hand_tracker) return null;
    this.frames_since_hands += 1;
    if (this.last_hand_result && this.frames_since_hands < this.hand_frame_interval) return this.last_hand_result;
    this.frames_since_hands = 0;
    this.last_hand_result = this.hand_tracker.track(camera_image, timestamp_ms, face_box);
    return this.last_hand_result;
  }

  close(): void {
    this.face_tracker.close();
    this.hand_tracker?.close();
  }
}
