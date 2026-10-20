import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { LANDMARK_CONNECTIONS, TrackerPair, type InferenceOptions } from "../infrastructure/frame_inference";

export { LANDMARK_CONNECTIONS };
import type { InferenceDelegate } from "../infrastructure/mediapipe_face_tracker";
import type { InferenceDevice } from "../domain/tracking_settings";
import { close_camera, open_camera, read_camera_info, type CameraInfo, type CameraRequest } from "../infrastructure/webcam_camera";
import type { TrackingHub } from "./tracking_hub";

export interface WebcamSessionDiagnostics {
  /** Time MediaPipe spent on the latest frame (face + hands). */
  inference_ms: number;
  landmarks: NormalizedLandmark[] | null;
  hand_landmarks: NormalizedLandmark[][];
  delegate: InferenceDelegate | null;
}

/** Feeds webcam frames through MediaPipe into the tracking hub, one inference per new video frame. */
export class WebcamTrackingSession {
  private tracker_pair: TrackerPair | null = null;
  private video_element: HTMLVideoElement | null = null;
  private video_frame_callback_id: number | null = null;
  /** The camera whose new frame waits for inference. */
  private pending_video: HTMLVideoElement | null = null;
  private is_hand_tracking_enabled = false;
  private inference_device: InferenceDevice = "gpu";
  private hand_frame_interval = 1;
  private last_timestamp_ms = 0;
  private latest_diagnostics: WebcamSessionDiagnostics = {
    inference_ms: 0,
    landmarks: null,
    hand_landmarks: [],
    delegate: null,
  };

  constructor(
    private readonly tracking_hub: TrackingHub,
    private readonly inference_options: InferenceOptions,
  ) {}

  get is_running(): boolean {
    return this.video_element !== null;
  }

  get camera_video(): HTMLVideoElement | null {
    return this.video_element;
  }

  get diagnostics(): WebcamSessionDiagnostics {
    return this.latest_diagnostics;
  }

  camera_info(): CameraInfo | null {
    return this.video_element ? read_camera_info(this.video_element) : null;
  }

  async start(camera_request: CameraRequest): Promise<void> {
    this.stop();
    this.tracker_pair ??= await TrackerPair.create(this.inference_options, this.inference_device);
    this.tracker_pair.hand_frame_interval = this.hand_frame_interval;
    await this.tracker_pair.set_hand_tracking_enabled(this.is_hand_tracking_enabled);
    this.latest_diagnostics = { ...this.latest_diagnostics, delegate: this.tracker_pair.delegate };
    this.video_element = await open_camera(camera_request);
    this.schedule_next_frame();
  }

  /** Hand tracking roughly doubles inference time, so it is opt-in. The model loads on first use. */
  async set_hand_tracking_enabled(is_enabled: boolean): Promise<void> {
    this.is_hand_tracking_enabled = is_enabled;
    await this.tracker_pair?.set_hand_tracking_enabled(is_enabled);
  }

  /** Takes effect on the next start(); the caller restarts a running session. */
  set_inference_device(device: InferenceDevice): void {
    if (device === this.inference_device) return;
    this.inference_device = device;
    this.tracker_pair?.close();
    this.tracker_pair = null;
  }

  set_hand_frame_interval(frame_interval: number): void {
    this.hand_frame_interval = frame_interval;
    if (this.tracker_pair) this.tracker_pair.hand_frame_interval = frame_interval;
  }

  stop(): void {
    if (this.video_element && this.video_frame_callback_id !== null) {
      this.video_element.cancelVideoFrameCallback(this.video_frame_callback_id);
    }
    if (this.video_element) close_camera(this.video_element);
    this.video_element = null;
    this.video_frame_callback_id = null;
    this.pending_video = null;
    this.latest_diagnostics = { ...this.latest_diagnostics, landmarks: null, hand_landmarks: [] };
  }

  dispose(): void {
    this.stop();
    this.inference_channel.port1.close();
    this.tracker_pair?.close();
    this.tracker_pair = null;
  }

  private schedule_next_frame(): void {
    const video_element = this.video_element;
    if (!video_element) return;
    this.video_frame_callback_id = video_element.requestVideoFrameCallback(() => {
      // Video frame callbacks run inside the page's rendering step; inference there (20-30 ms)
      // made every other avatar frame miss the screen refresh. Run it right after that step.
      this.pending_video = video_element;
      this.inference_channel.port2.postMessage(null);
    });
  }

  private readonly inference_channel = (() => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      // Cleared by stop(), so a message left over from a stopped camera starts no second loop.
      const video_element = this.pending_video;
      this.pending_video = null;
      if (!video_element) return;
      this.process_frame(video_element);
      this.schedule_next_frame();
    };
    return channel;
  })();

  private process_frame(video_element: HTMLVideoElement): void {
    if (!this.tracker_pair) return;
    // MediaPipe requires strictly increasing timestamps.
    const timestamp_ms = Math.max(performance.now(), this.last_timestamp_ms + 1);
    this.last_timestamp_ms = timestamp_ms;
    try {
      const inference_result = this.tracker_pair.run(video_element, timestamp_ms);
      this.latest_diagnostics = {
        ...this.latest_diagnostics,
        inference_ms: inference_result.inference_ms,
        landmarks: inference_result.face_landmarks,
        hand_landmarks: inference_result.hand_landmarks,
      };
      this.tracking_hub.push_frame(inference_result.face_frame);
    } catch (inference_error) {
      console.error("Face tracking failed on a frame", inference_error);
    }
  }
}
