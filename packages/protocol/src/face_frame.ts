import { z } from "zod";
import { ARKIT_BLENDSHAPE_NAMES } from "./arkit_blendshapes";

export const FACE_FRAME_PROTOCOL_VERSION = 1;

export const tracking_source_schema = z.enum(["desktop-webcam", "ios-arkit", "android-mediapipe"]);

const vector_3_schema = z.tuple([z.number(), z.number(), z.number()]);
const quaternion_schema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
// [yaw, pitch] in radians, positive yaw = looking to the camera's right.
const eye_gaze_schema = z.tuple([z.number(), z.number()]);

export const HAND_LANDMARK_COUNT = 21;

/**
 * 21 hand points in MediaPipe order (0 wrist, 4 thumb tip, 8 index tip, ...).
 * [x, y] are 0..1 in the unmirrored camera image, origin top left; z is relative depth.
 */
export const hand_pose_schema = z.object({
  landmarks: z.array(z.tuple([z.number(), z.number(), z.number()])).length(HAND_LANDMARK_COUNT),
  /** Estimated camera-to-hand distance, on the same scale as head.position_meters. */
  distance_meters: z.number().positive().optional(),
});

/**
 * One tracking sample. Every source (webcam, iPhone, Android) produces this shape,
 * so everything downstream of the tracking hub never knows where data came from.
 * A missing blendshape key means 0.
 */
export const face_frame_schema = z.object({
  protocol_version: z.literal(FACE_FRAME_PROTOCOL_VERSION),
  timestamp_ms: z.number(),
  source: tracking_source_schema,
  face_found: z.boolean(),
  head: z.object({
    position_meters: vector_3_schema,
    rotation_quaternion: quaternion_schema,
  }),
  eyes: z.object({
    left: eye_gaze_schema,
    right: eye_gaze_schema,
  }),
  blendshapes: z.partialRecord(z.enum(ARKIT_BLENDSHAPE_NAMES), z.number().min(0).max(1)),
  /** Optional: sources without hand tracking omit it. left/right are the user's real hands. */
  hands: z
    .object({
      left: hand_pose_schema.nullable(),
      right: hand_pose_schema.nullable(),
      /** Camera image width / height, needed to keep hand proportions. */
      image_aspect_ratio: z.number().positive().default(4 / 3),
    })
    .optional(),
});

export type FaceFrame = z.infer<typeof face_frame_schema>;
export type TrackingSource = z.infer<typeof tracking_source_schema>;
export type FaceBlendshapes = FaceFrame["blendshapes"];
export type Quaternion = FaceFrame["head"]["rotation_quaternion"];
export type Vector3 = FaceFrame["head"]["position_meters"];
export type HandPose = z.infer<typeof hand_pose_schema>;
export type HandPoses = NonNullable<FaceFrame["hands"]>;

export const IDENTITY_QUATERNION: Quaternion = [0, 0, 0, 1];

export function create_empty_face_frame(source: TrackingSource, timestamp_ms: number): FaceFrame {
  return {
    protocol_version: FACE_FRAME_PROTOCOL_VERSION,
    timestamp_ms,
    source,
    face_found: false,
    head: { position_meters: [0, 0, 0], rotation_quaternion: IDENTITY_QUATERNION },
    eyes: { left: [0, 0], right: [0, 0] },
    blendshapes: {},
  };
}
