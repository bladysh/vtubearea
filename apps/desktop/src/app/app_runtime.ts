import { app_config } from "../config/app_config";
import type { AvatarControlPort } from "../contexts/avatar/application/avatar_control_port";
import { AvatarFrameComposer } from "../contexts/avatar/application/avatar_frame_composer";
import { TrackingHub } from "../contexts/tracking/application/tracking_hub";
import { WebcamTrackingSession } from "../contexts/tracking/application/webcam_tracking_session";
import { MetricHistory } from "../shared/metric_history";

/**
 * Composition root: the long-lived services, created once. Stores and views
 * reach the runtime through these objects; nothing else constructs them.
 */
export const tracking_hub = new TrackingHub(
  app_config.tracking.face_lost_timeout_ms,
  () => performance.now(),
  app_config.tracking.hand_lost_timeout_ms,
);

// Absolute URLs: the tracking worker resolves relative paths against its own script, not the page.
const absolute_url = (path: string) => new URL(path, window.location.href).href;

export const webcam_tracking_session = new WebcamTrackingSession(tracking_hub, {
  wasm_url: absolute_url(app_config.tracking.wasm_path),
  face_model_url: absolute_url(app_config.tracking.model_path),
  hand_model_url: absolute_url(app_config.tracking.hand_model_path),
  use_gpu: app_config.tracking.use_gpu,
  face_confidence: app_config.tracking.face_confidence,
  hand_confidence: app_config.tracking.hand_confidence,
});

export const avatar_frame_composer = new AvatarFrameComposer(app_config.idle_motion);

/** The single door for outside controllers (debug panel now, MCP / plugin API later). */
export const avatar_control: AvatarControlPort = avatar_frame_composer;

/** Last seconds of tracking inputs and performance numbers, for the live charts. */
export const metric_history = new MetricHistory(8000);
export const CHART_WINDOW_MS = 6000;

/** Written by the render loop, read by the debug overlay. */
export const render_statistics = {
  frames_per_second: 0,
  compose_milliseconds: 0,
};
