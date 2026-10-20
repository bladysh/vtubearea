import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { eye_blink_from_mesh } from "../domain/eye_openness";
import {
  create_empty_face_frame,
  is_arkit_blendshape_name,
  rotation_matrix_to_quaternion,
  type FaceBlendshapes,
  type FaceFrame,
} from "@vtubearea/protocol";

export interface ConfidenceThresholds {
  detection: number;
  presence: number;
  tracking: number;
}

/** A camera frame: the live video element or a bitmap copied from it. */
export type CameraImage = HTMLVideoElement | ImageBitmap;

export function camera_image_size(camera_image: CameraImage): { width: number; height: number } {
  return camera_image instanceof ImageBitmap
    ? { width: camera_image.width, height: camera_image.height }
    : { width: camera_image.videoWidth, height: camera_image.videoHeight };
}

export interface FaceTrackerOptions {
  wasm_path: string;
  model_path: string;
  use_gpu: boolean;
  confidence: ConfidenceThresholds;
}

export interface FaceTrackingResult {
  face_frame: FaceFrame;
  /** 478 normalized landmarks of the first face, for the debug overlay. */
  landmarks: NormalizedLandmark[] | null;
}

const CENTIMETERS_TO_METERS = 0.01;

export type InferenceDelegate = "GPU" | "CPU";

/** MediaPipe Face Landmarker running in the WebView (WASM, GPU when available). */
export class MediapipeFaceTracker {
  private constructor(
    private readonly face_landmarker: FaceLandmarker,
    /** Which hardware actually runs the model, shown in the debug overlay. */
    readonly delegate: InferenceDelegate,
  ) {}

  static async create(options: FaceTrackerOptions): Promise<MediapipeFaceTracker> {
    const vision_fileset = await FilesetResolver.forVisionTasks(options.wasm_path);
    const create_landmarker = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(vision_fileset, {
        baseOptions: { modelAssetPath: options.model_path, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        // Lower than MediaPipe's 0.5 default so a face turned far to the side stays tracked.
        minFaceDetectionConfidence: options.confidence.detection,
        minFacePresenceConfidence: options.confidence.presence,
        minTrackingConfidence: options.confidence.tracking,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    try {
      const preferred_delegate: InferenceDelegate = options.use_gpu ? "GPU" : "CPU";
      return new MediapipeFaceTracker(await create_landmarker(preferred_delegate), preferred_delegate);
    } catch (gpu_error) {
      if (!options.use_gpu) throw gpu_error;
      console.warn("GPU face tracking unavailable, falling back to CPU", gpu_error);
      return new MediapipeFaceTracker(await create_landmarker("CPU"), "CPU");
    }
  }

  /** Timestamps must increase between calls, as MediaPipe VIDEO mode requires. */
  track(camera_image: CameraImage, timestamp_ms: number): FaceTrackingResult {
    const landmarker_result = this.face_landmarker.detectForVideo(camera_image, timestamp_ms);
    return {
      face_frame: to_face_frame(landmarker_result, timestamp_ms, camera_image_size(camera_image)),
      landmarks: landmarker_result.faceLandmarks[0] ?? null,
    };
  }

  close(): void {
    this.face_landmarker.close();
  }
}

/**
 * Share of the blink taken from the lid gap; the rest is MediaPipe's own blink value. Kept high:
 * MediaPipe reports a shut eye while the lids are still well apart, so the eye closed too early.
 */
const LID_GAP_BLINK_SHARE = 0.8;

function to_face_frame(landmarker_result: FaceLandmarkerResult, timestamp_ms: number, image_size: { width: number; height: number }): FaceFrame {
  const face_frame = create_empty_face_frame("desktop-webcam", timestamp_ms);
  const blendshape_categories = landmarker_result.faceBlendshapes[0]?.categories;
  const transformation_matrix = landmarker_result.facialTransformationMatrixes[0]?.data;
  if (!blendshape_categories || !transformation_matrix) return face_frame;

  const blendshapes: FaceBlendshapes = {};
  for (const category of blendshape_categories) {
    if (is_arkit_blendshape_name(category.categoryName)) blendshapes[category.categoryName] = category.score;
  }
  // MediaPipe's blink score jumps between open and shut; the lid gap follows a squint smoothly.
  const lid_gap_blink = eye_blink_from_mesh(landmarker_result.faceLandmarks[0] ?? [], image_size.width / Math.max(image_size.height, 1));
  if (lid_gap_blink) {
    blendshapes.eyeBlinkLeft = (blendshapes.eyeBlinkLeft ?? 0) * (1 - LID_GAP_BLINK_SHARE) + lid_gap_blink.left * LID_GAP_BLINK_SHARE;
    blendshapes.eyeBlinkRight = (blendshapes.eyeBlinkRight ?? 0) * (1 - LID_GAP_BLINK_SHARE) + lid_gap_blink.right * LID_GAP_BLINK_SHARE;
  }
  return {
    ...face_frame,
    face_found: true,
    head: {
      // MediaPipe's canonical face model uses centimeters.
      position_meters: [
        (transformation_matrix[12] ?? 0) * CENTIMETERS_TO_METERS,
        (transformation_matrix[13] ?? 0) * CENTIMETERS_TO_METERS,
        (transformation_matrix[14] ?? 0) * CENTIMETERS_TO_METERS,
      ],
      rotation_quaternion: rotation_matrix_to_quaternion(transformation_matrix),
    },
    blendshapes,
  };
}
