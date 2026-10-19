import { X } from "lucide-react";
import { IconButton, useTranslate } from "@vtubearea/ui";
import { render_statistics, tracking_hub, webcam_tracking_session } from "../../../app/app_runtime";
import { usePolledValue } from "../../../shared/use_polled_value";
import { useSettingsStore } from "../../settings/application/settings_store";
import { BlendshapeMeters } from "./blendshape_meters";
import { PerformanceCharts } from "./performance_charts";
import { ParameterInspector } from "./parameter_inspector";
import "./debug.css";

function read_debug_snapshot() {
  const tracking_snapshot = tracking_hub.snapshot();
  return {
    render_frames_per_second: render_statistics.frames_per_second,
    compose_milliseconds: render_statistics.compose_milliseconds,
    tracking_frames_per_second: tracking_snapshot.frames_per_second,
    inference_milliseconds: webcam_tracking_session.diagnostics.inference_ms,
    delegate: webcam_tracking_session.diagnostics.delegate,
    camera_info: webcam_tracking_session.camera_info(),
    latency_milliseconds: tracking_snapshot.latency_ms,
    is_face_found: tracking_snapshot.is_face_found,
    source: tracking_snapshot.source,
    input_values: tracking_snapshot.input_values,
    blendshapes: tracking_snapshot.latest_frame?.blendshapes ?? {},
  };
}

/** Live numbers for tuning tracking and models. Toggle with the debug hotkey. */
export function DebugOverlay() {
  const translate = useTranslate();
  const toggle_debug_overlay = useSettingsStore((state) => state.toggle_debug_overlay);
  const debug_snapshot = usePolledValue(read_debug_snapshot, 100);
  const head_inputs = ["FaceAngleX", "FaceAngleY", "FaceAngleZ"] as const;

  const statistics = [
    { label: translate("debug.render_fps"), value: debug_snapshot.render_frames_per_second.toFixed(0) },
    { label: translate("debug.compose_time"), value: `${debug_snapshot.compose_milliseconds.toFixed(2)} ms` },
    { label: translate("debug.tracking_fps"), value: debug_snapshot.tracking_frames_per_second.toFixed(0) },
    { label: translate("debug.inference_time"), value: `${debug_snapshot.inference_milliseconds.toFixed(1)} ms` },
    { label: translate("debug.latency"), value: `${debug_snapshot.latency_milliseconds.toFixed(0)} ms` },
    { label: translate("debug.source"), value: debug_snapshot.source ?? "—" },
    { label: translate("debug.delegate"), value: debug_snapshot.delegate ?? "—" },
    {
      label: translate("debug.camera_size"),
      value: debug_snapshot.camera_info
        ? `${debug_snapshot.camera_info.actual_width}×${debug_snapshot.camera_info.actual_height} @${Math.round(debug_snapshot.camera_info.actual_frame_rate ?? 0)}`
        : "—",
    },
  ];

  return (
    <aside className="debug-overlay vta-panel" aria-label={translate("debug.title")}>
      <header className="debug-overlay__header">
        <span className="debug-overlay__title">{translate("debug.title")}</span>
        <span className={`debug-overlay__face ${debug_snapshot.is_face_found ? "is-found" : ""}`}>
          {translate(debug_snapshot.is_face_found ? "tracking.face_found" : "tracking.face_lost")}
        </span>
        <IconButton label={translate("common.close")} icon={<X size={14} />} onClick={toggle_debug_overlay} />
      </header>
      <div className="debug-overlay__body">
        <dl className="debug-stats">
          {statistics.map((statistic) => (
            <div key={statistic.label} className="debug-stats__item">
              <dt>{statistic.label}</dt>
              <dd>{statistic.value}</dd>
            </div>
          ))}
          {head_inputs.map((input_name) => (
            <div key={input_name} className="debug-stats__item">
              <dt>{input_name}</dt>
              <dd>{(debug_snapshot.input_values[input_name] ?? 0).toFixed(1)}°</dd>
            </div>
          ))}
        </dl>
        <details className="debug-section" open>
          <summary>{translate("debug.performance")}</summary>
          <PerformanceCharts />
        </details>
        <details className="debug-section" open>
          <summary>{translate("debug.parameters")}</summary>
          <ParameterInspector />
        </details>
        <details className="debug-section">
          <summary>{translate("debug.blendshapes")}</summary>
          <BlendshapeMeters blendshapes={debug_snapshot.blendshapes} />
        </details>
      </div>
    </aside>
  );
}
