export interface CameraDevice {
  device_id: string;
  label: string;
}

export interface CameraRequest {
  device_id: string | null;
  width: number;
  height: number;
  frame_rate: number;
}

/** What the open camera can do and what it actually delivers. */
export interface CameraInfo {
  maximum_width: number | null;
  maximum_height: number | null;
  maximum_frame_rate: number | null;
  actual_width: number;
  actual_height: number;
  actual_frame_rate: number | null;
}

/** Ids and labels are empty until the user has granted camera access once; such entries are skipped. */
export async function list_camera_devices(): Promise<CameraDevice[]> {
  const media_devices = await navigator.mediaDevices.enumerateDevices();
  return media_devices
    .filter((media_device) => media_device.kind === "videoinput" && media_device.deviceId !== "")
    .map((media_device, device_index) => ({
      device_id: media_device.deviceId,
      label: media_device.label || `Camera ${device_index + 1}`,
    }));
}

export async function open_camera(camera_request: CameraRequest): Promise<HTMLVideoElement> {
  const media_stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: camera_request.device_id ? { exact: camera_request.device_id } : undefined,
      width: { ideal: camera_request.width },
      height: { ideal: camera_request.height },
      frameRate: { ideal: camera_request.frame_rate },
    },
  });
  const video_element = document.createElement("video");
  video_element.muted = true;
  video_element.playsInline = true;
  video_element.srcObject = media_stream;
  await video_element.play();
  return video_element;
}

export function read_camera_info(video_element: HTMLVideoElement): CameraInfo | null {
  const video_track = (video_element.srcObject as MediaStream | null)?.getVideoTracks()[0];
  if (!video_track) return null;
  // getCapabilities is missing in some older WebViews; then only actual values are known.
  const capabilities = typeof video_track.getCapabilities === "function" ? video_track.getCapabilities() : {};
  const track_settings = video_track.getSettings();
  return {
    maximum_width: capabilities.width?.max ?? null,
    maximum_height: capabilities.height?.max ?? null,
    maximum_frame_rate: capabilities.frameRate?.max ?? null,
    actual_width: video_element.videoWidth,
    actual_height: video_element.videoHeight,
    actual_frame_rate: track_settings.frameRate ?? null,
  };
}

export function close_camera(video_element: HTMLVideoElement): void {
  const media_stream = video_element.srcObject as MediaStream | null;
  media_stream?.getTracks().forEach((media_track) => media_track.stop());
  video_element.srcObject = null;
}
