import { z } from "zod";

const boolean_from_env = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
const positive_integer_from_env = z.coerce.number().int().positive();
const unit_interval_from_env = z.coerce.number().min(0).max(1);

const app_config_schema = z.object({
  VITE_CAMERA_WIDTH: positive_integer_from_env.default(1280),
  VITE_CAMERA_HEIGHT: positive_integer_from_env.default(720),
  VITE_CAMERA_FRAME_RATE: positive_integer_from_env.default(30),
  VITE_TRACKING_MODEL_PATH: z.string().default("/mediapipe/face_landmarker.task"),
  VITE_TRACKING_WASM_PATH: z.string().default("/mediapipe/wasm"),
  VITE_TRACKING_USE_GPU: boolean_from_env.default(true),
  VITE_CALIBRATION_DURATION_MS: positive_integer_from_env.default(2000),
  VITE_EXPRESSION_CALIBRATION_DURATION_MS: positive_integer_from_env.default(8000),
  VITE_FACE_LOST_TIMEOUT_MS: positive_integer_from_env.default(800),
  VITE_FACE_DETECTION_CONFIDENCE: unit_interval_from_env.default(0.3),
  VITE_FACE_PRESENCE_CONFIDENCE: unit_interval_from_env.default(0.3),
  VITE_FACE_TRACKING_CONFIDENCE: unit_interval_from_env.default(0.3),
  VITE_HAND_MODEL_PATH: z.string().default("/mediapipe/hand_landmarker.task"),
  VITE_HAND_DETECTION_CONFIDENCE: unit_interval_from_env.default(0.5),
  VITE_HAND_PRESENCE_CONFIDENCE: unit_interval_from_env.default(0.3),
  VITE_HAND_TRACKING_CONFIDENCE: unit_interval_from_env.default(0.3),
  VITE_HAND_LOST_TIMEOUT_MS: positive_integer_from_env.default(450),
  VITE_AUTO_BLINK_MIN_INTERVAL_MS: positive_integer_from_env.default(2500),
  VITE_AUTO_BLINK_MAX_INTERVAL_MS: positive_integer_from_env.default(6000),
  VITE_BREATHING_PERIOD_MS: positive_integer_from_env.default(3500),
  VITE_RENDER_MAX_FPS: positive_integer_from_env.default(60),
  VITE_RENDER_ANTIALIAS: boolean_from_env.default(true),
  VITE_DEFAULT_LOCALE: z.enum(["en", "ru"]).default("ru"),
  VITE_DEBUG_MODE_DEFAULT: boolean_from_env.default(false),
  VITE_HOTKEY_TOGGLE_INTERFACE: z.string().default("Mod+Shift+KeyH"),
  VITE_HOTKEY_TOGGLE_DEBUG: z.string().default("Mod+Shift+KeyD"),
  VITE_HOTKEY_CALIBRATE: z.string().default("Mod+Shift+KeyK"),
});

// Injected by vite.config.ts from apps/desktop/package.json.
declare const __APP_VERSION__: string;

/** Empty .env lines mean "use the default", not "empty string". */
function drop_empty_values(environment: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(environment).filter(([, value]) => value !== ""));
}

const parsed_environment = app_config_schema.parse(drop_empty_values(import.meta.env));

export const app_config = {
  app: {
    version: __APP_VERSION__,
    /** Shown in About until 1.0. */
    stage_label: "beta",
    authors: ["bladysh", "Claude"],
  },
  camera: {
    width: parsed_environment.VITE_CAMERA_WIDTH,
    height: parsed_environment.VITE_CAMERA_HEIGHT,
    frame_rate: parsed_environment.VITE_CAMERA_FRAME_RATE,
  },
  tracking: {
    model_path: parsed_environment.VITE_TRACKING_MODEL_PATH,
    wasm_path: parsed_environment.VITE_TRACKING_WASM_PATH,
    use_gpu: parsed_environment.VITE_TRACKING_USE_GPU,
    calibration_duration_ms: parsed_environment.VITE_CALIBRATION_DURATION_MS,
    /** Time to pull faces for the expression calibration (blink, brows, mouth). */
    expression_calibration_duration_ms: parsed_environment.VITE_EXPRESSION_CALIBRATION_DURATION_MS,
    face_lost_timeout_ms: parsed_environment.VITE_FACE_LOST_TIMEOUT_MS,
    face_confidence: {
      detection: parsed_environment.VITE_FACE_DETECTION_CONFIDENCE,
      presence: parsed_environment.VITE_FACE_PRESENCE_CONFIDENCE,
      tracking: parsed_environment.VITE_FACE_TRACKING_CONFIDENCE,
    },
    hand_model_path: parsed_environment.VITE_HAND_MODEL_PATH,
    hand_confidence: {
      detection: parsed_environment.VITE_HAND_DETECTION_CONFIDENCE,
      presence: parsed_environment.VITE_HAND_PRESENCE_CONFIDENCE,
      tracking: parsed_environment.VITE_HAND_TRACKING_CONFIDENCE,
    },
    hand_lost_timeout_ms: parsed_environment.VITE_HAND_LOST_TIMEOUT_MS,
  },
  idle_motion: {
    auto_blink_min_interval_ms: parsed_environment.VITE_AUTO_BLINK_MIN_INTERVAL_MS,
    auto_blink_max_interval_ms: parsed_environment.VITE_AUTO_BLINK_MAX_INTERVAL_MS,
    breathing_period_ms: parsed_environment.VITE_BREATHING_PERIOD_MS,
  },
  render: {
    max_frames_per_second: parsed_environment.VITE_RENDER_MAX_FPS,
    antialias: parsed_environment.VITE_RENDER_ANTIALIAS,
  },
  interface: {
    default_locale: parsed_environment.VITE_DEFAULT_LOCALE,
    debug_mode_default: parsed_environment.VITE_DEBUG_MODE_DEFAULT,
  },
  hotkeys: {
    toggle_interface: parsed_environment.VITE_HOTKEY_TOGGLE_INTERFACE,
    toggle_debug: parsed_environment.VITE_HOTKEY_TOGGLE_DEBUG,
    calibrate: parsed_environment.VITE_HOTKEY_CALIBRATE,
  },
} as const;

export type AppConfig = typeof app_config;
