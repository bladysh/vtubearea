import { useMemo } from "react";
import { LiveLineChart, useTranslate } from "@vtubearea/ui";
import { CHART_WINDOW_MS, metric_history } from "../../../app/app_runtime";
import { useSettingsStore } from "../../settings/application/settings_store";

const read_samples = () => metric_history.read();
const format_frames = (value: number) => String(Math.round(value));
const format_milliseconds = (value: number) => `${Math.round(value)} ms`;

/** Frame rates on one axis (same unit), inference time on its own chart. */
export function PerformanceCharts() {
  const translate = useTranslate();
  const max_frames_per_second = useSettingsStore((state) => state.max_frames_per_second);
  const frame_rate_series = useMemo(
    () => [
      { key: "RenderFramesPerSecond", label: translate("debug.render_fps") },
      { key: "TrackingFramesPerSecond", label: translate("debug.tracking_fps") },
    ],
    [translate],
  );
  const inference_series = useMemo(() => [{ key: "InferenceMilliseconds", label: translate("debug.inference_time") }], [translate]);

  return (
    <div className="chart-list">
      <LiveLineChart
        title={translate("debug.frame_rates")}
        series={frame_rate_series}
        read_samples={read_samples}
        window_ms={CHART_WINDOW_MS}
        y_minimum={0}
        y_maximum={Math.max(60, max_frames_per_second)}
        format_value={format_frames}
        height={72}
      />
      <LiveLineChart
        title={translate("debug.inference_time")}
        series={inference_series}
        read_samples={read_samples}
        window_ms={CHART_WINDOW_MS}
        y_minimum={0}
        y_maximum={50}
        format_value={format_milliseconds}
        height={56}
      />
    </div>
  );
}
