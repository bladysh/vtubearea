import { CameraOff } from "lucide-react";
import { Field, SegmentedControl, Section, SelectField, ToggleField, useTranslate } from "@vtubearea/ui";
import { app_config } from "../../../config/app_config";
import { useTrackingStore } from "../application/tracking_store";
import { CAMERA_FRAME_RATE_PRESETS, CAMERA_RESOLUTION_PRESETS, type CameraPreviewMode, type InferenceDevice } from "../domain/tracking_settings";
import { CameraPreview } from "./camera_preview";

const to_resolution_value = (width: number, height: number) => `${width}x${height}`;

/** View options with the live preview and its tracking mask right under them, then camera settings. */
export function CameraTab() {
  const translate = useTranslate();
  const settings = useTrackingStore((state) => state.settings);
  const session_status = useTrackingStore((state) => state.session_status);
  const error_message = useTrackingStore((state) => state.error_message);
  const camera_devices = useTrackingStore((state) => state.camera_devices);
  const camera_info = useTrackingStore((state) => state.camera_info);
  const update_settings = useTrackingStore((state) => state.update_settings);
  const camera_mode = settings.camera_mode ?? app_config.camera;
  const preview_mode_options: { value: CameraPreviewMode; label: string }[] = [
    { value: "video", label: translate("tracking.preview.video") },
    { value: "tracking_only", label: translate("tracking.preview.tracking_only") },
    { value: "hidden", label: translate("tracking.preview.hidden") },
  ];

  // Offer only modes the camera can do, once we know its limits.
  const resolution_options = CAMERA_RESOLUTION_PRESETS.filter(
    (preset) => !camera_info?.maximum_width || (preset.width <= camera_info.maximum_width && preset.height <= (camera_info.maximum_height ?? Infinity)),
  ).map((preset) => ({ value: to_resolution_value(preset.width, preset.height), label: `${preset.width} × ${preset.height}` }));
  // The camera's own limit is offered too, even when it is not a common size.
  const maximum_resolution_value =
    camera_info?.maximum_width && camera_info.maximum_height ? to_resolution_value(camera_info.maximum_width, camera_info.maximum_height) : null;
  if (maximum_resolution_value && !resolution_options.some((option) => option.value === maximum_resolution_value)) {
    resolution_options.push({
      value: maximum_resolution_value,
      label: translate("tracking.resolution_maximum", { width: camera_info!.maximum_width!, height: camera_info!.maximum_height! }),
    });
  }
  const current_resolution_value = to_resolution_value(camera_mode.width, camera_mode.height);
  if (!resolution_options.some((option) => option.value === current_resolution_value)) {
    resolution_options.push({ value: current_resolution_value, label: `${camera_mode.width} × ${camera_mode.height}` });
  }
  const frame_rate_options = CAMERA_FRAME_RATE_PRESETS.filter(
    (frame_rate) => !camera_info?.maximum_frame_rate || frame_rate <= camera_info.maximum_frame_rate,
  ).map((frame_rate) => ({ value: String(frame_rate), label: `${frame_rate} FPS` }));
  const maximum_frame_rate = camera_info?.maximum_frame_rate ? Math.floor(camera_info.maximum_frame_rate) : null;
  if (maximum_frame_rate && !frame_rate_options.some((option) => option.value === String(maximum_frame_rate))) {
    frame_rate_options.push({ value: String(maximum_frame_rate), label: translate("tracking.frame_rate_maximum", { frame_rate: maximum_frame_rate }) });
  }
  const inference_device_options: { value: InferenceDevice; label: string }[] = [
    { value: "gpu", label: translate("tracking.inference_device.gpu") },
    { value: "cpu", label: translate("tracking.inference_device.cpu") },
    { value: "face_gpu_hands_cpu", label: translate("tracking.inference_device.face_gpu_hands_cpu") },
  ];
  const camera_options = [
    { value: "", label: translate("tracking.default_camera") },
    ...camera_devices.map((camera_device) => ({ value: camera_device.device_id, label: camera_device.label })),
  ];

  return (
    <>
      <Section title={translate("tracking.view")}>
        <Field
          label={translate("tracking.show_preview")}
          hint={translate("tracking.show_preview_hint")}
          is_stacked
          control={
            <SegmentedControl
              label={translate("tracking.show_preview")}
              value={settings.camera_preview_mode}
              options={preview_mode_options}
              on_change={(camera_preview_mode) => void update_settings({ camera_preview_mode })}
            />
          }
        />
        <ToggleField
          label={translate("tracking.mirror")}
          hint={translate("tracking.mirror_hint")}
          is_checked={settings.is_mirrored}
          on_change={(is_mirrored) => void update_settings({ is_mirrored })}
        />
        {session_status === "running" && settings.camera_preview_mode !== "hidden" ? (
          <CameraPreview is_mirrored={settings.is_mirrored} shows_video={settings.camera_preview_mode === "video"} />
        ) : (
          <div className="camera-placeholder">
            <CameraOff size={28} />
            <span>{translate(session_status === "starting" ? "tracking.starting" : "tracking.camera_off")}</span>
          </div>
        )}
        {error_message && <p className="error-text">{translate("tracking.error", { message: error_message })}</p>}
        {camera_info && (
          <p className="vta-field__hint">
            {translate("tracking.camera_actual", {
              width: camera_info.actual_width,
              height: camera_info.actual_height,
              frame_rate: Math.round(camera_info.actual_frame_rate ?? 0),
            })}
          </p>
        )}
      </Section>

      <Section title={translate("tracking.camera_settings")}>
        <SelectField
          label={translate("tracking.camera_device")}
          value={settings.camera_device_id ?? ""}
          options={camera_options}
          on_change={(device_id) => void update_settings({ camera_device_id: device_id || null })}
        />
        <SelectField
          label={translate("tracking.resolution")}
          hint={translate("tracking.resolution_hint")}
          value={to_resolution_value(camera_mode.width, camera_mode.height)}
          options={resolution_options}
          on_change={(resolution_value) => {
            const [width, height] = resolution_value.split("x").map(Number);
            void update_settings({ camera_mode: { ...camera_mode, width: width!, height: height! } });
          }}
        />
        <SelectField
          label={translate("tracking.frame_rate")}
          hint={translate("tracking.frame_rate_hint")}
          value={String(camera_mode.frame_rate)}
          options={frame_rate_options}
          on_change={(frame_rate) => void update_settings({ camera_mode: { ...camera_mode, frame_rate: Number(frame_rate) } })}
        />
        <SelectField
          label={translate("tracking.inference_device")}
          hint={translate("tracking.inference_device_hint")}
          value={settings.inference_device}
          options={inference_device_options}
          on_change={(inference_device) => void update_settings({ inference_device })}
        />
        {camera_info?.maximum_width && (
          <Field
            label={translate("tracking.camera_maximum")}
            value_label={`${camera_info.maximum_width} × ${camera_info.maximum_height} @${Math.round(camera_info.maximum_frame_rate ?? 0)}`}
            control={null}
          />
        )}
      </Section>
    </>
  );
}
