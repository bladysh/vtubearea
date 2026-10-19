import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { HandPoses } from "@vtubearea/protocol";
import { HandAppearanceGate, type ImageBox } from "../domain/hand_appearance_gate";
import { estimate_hand_distance_meters, focal_length_pixels } from "../domain/hand_depth";
import { HandSideAssigner, type HandDetection } from "../domain/hand_side_assigner";

// Frames a new hand must be seen in a row before it is shown (filters phantom hands).
const NEW_HAND_CONFIRMATION_FRAMES = 3;
import { camera_image_size, type CameraImage, type ConfidenceThresholds, type InferenceDelegate } from "./mediapipe_face_tracker";

export interface HandTrackerOptions {
  wasm_path: string;
  model_path: string;
  use_gpu: boolean;
  confidence: ConfidenceThresholds;
}

export interface HandTrackingResult {
  hands: HandPoses;
  /** Raw points of every detected hand, for the debug overlay. */
  landmarks: NormalizedLandmark[][];
}

/** MediaPipe Hand Landmarker: up to two hands per frame. */
export class MediapipeHandTracker {
  private readonly side_assigner = new HandSideAssigner();
  private readonly appearance_gate = new HandAppearanceGate(NEW_HAND_CONFIRMATION_FRAMES);

  private constructor(
    private readonly hand_landmarker: HandLandmarker,
    readonly delegate: InferenceDelegate,
  ) {}

  static async create(options: HandTrackerOptions): Promise<MediapipeHandTracker> {
    const vision_fileset = await FilesetResolver.forVisionTasks(options.wasm_path);
    const create_landmarker = (delegate: "GPU" | "CPU") =>
      HandLandmarker.createFromOptions(vision_fileset, {
        baseOptions: { modelAssetPath: options.model_path, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: options.confidence.detection,
        minHandPresenceConfidence: options.confidence.presence,
        minTrackingConfidence: options.confidence.tracking,
      });
    try {
      const preferred_delegate: InferenceDelegate = options.use_gpu ? "GPU" : "CPU";
      return new MediapipeHandTracker(await create_landmarker(preferred_delegate), preferred_delegate);
    } catch (gpu_error) {
      if (!options.use_gpu) throw gpu_error;
      console.warn("GPU hand tracking unavailable, falling back to CPU", gpu_error);
      return new MediapipeHandTracker(await create_landmarker("CPU"), "CPU");
    }
  }

  /** face_box: where the face is in this frame, so a phantom hand there can be ignored. */
  track(camera_image: CameraImage, timestamp_ms: number, face_box: ImageBox | null): HandTrackingResult {
    const landmarker_result = this.hand_landmarker.detectForVideo(camera_image, timestamp_ms);
    const image_size = camera_image_size(camera_image);
    const image_aspect_ratio = image_size.height > 0 ? image_size.width / image_size.height : 4 / 3;
    const focal_length = focal_length_pixels(image_size.height);
    const detections: HandDetection[] = landmarker_result.landmarks.map((hand_landmarks, hand_index) => {
      const image_points = hand_landmarks.map((landmark) => [landmark.x * image_size.width, landmark.y * image_size.height] as const);
      const world_points = (landmarker_result.worldLandmarks[hand_index] ?? []).map((landmark) => [landmark.x, landmark.y, landmark.z] as const);
      const distance_meters = estimate_hand_distance_meters(image_points, world_points, focal_length) ?? undefined;
      return {
        pose: { landmarks: hand_landmarks.map((landmark) => [landmark.x, landmark.y, landmark.z]), distance_meters },
      };
    });
    const real_detections = this.appearance_gate.filter(detections, timestamp_ms, face_box);
    const face_center_x = face_box ? (face_box.minimum_x + face_box.maximum_x) / 2 : 0.5;
    const assigned_hands = this.side_assigner.assign(real_detections, timestamp_ms, face_center_x);
    const hands: HandPoses = { left: assigned_hands.left, right: assigned_hands.right, image_aspect_ratio };
    return { hands, landmarks: landmarker_result.landmarks };
  }

  close(): void {
    this.hand_landmarker.close();
  }
}
