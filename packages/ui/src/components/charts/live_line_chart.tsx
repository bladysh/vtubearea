import { useEffect, useRef, useState } from "react";
import {
  CHART_GRID_COLOR,
  CHART_SERIES_COLORS,
  CHART_SINGLE_SERIES_COLOR,
  CHART_SURFACE_COLOR,
  CHART_TEXT_MUTED_COLOR,
} from "./chart_palette";

export interface ChartSample {
  time_ms: number;
  values: Readonly<Record<string, number>>;
}

export interface LiveChartSeries {
  key: string;
  label: string;
}

interface LiveLineChartProps {
  title: string;
  /** At most three; colors follow the series order and never change. */
  series: readonly LiveChartSeries[];
  /** Called every animation frame; returns samples oldest first. */
  read_samples: () => readonly ChartSample[];
  window_ms: number;
  y_minimum: number;
  y_maximum: number;
  format_value: (value: number) => string;
  height?: number;
}

const AXIS_LABEL_GAP = 6;
const SINGLE_SERIES_COLORS = [CHART_SINGLE_SERIES_COLOR] as const;
const LEGEND_REFRESH_MS = 150;

/** Scrolling line chart for live signals, drawn on canvas so it can redraw every frame. */
export function LiveLineChart({ title, series, read_samples, window_ms, y_minimum, y_maximum, format_value, height = 96 }: LiveLineChartProps) {
  const canvas_ref = useRef<HTMLCanvasElement>(null);
  const hover_x_ref = useRef<number | null>(null);
  const [latest_values, set_latest_values] = useState<Record<string, number | undefined>>({});
  const [hover_tooltip, set_hover_tooltip] = useState<{ left: number; lines: string[] } | null>(null);
  const series_colors: readonly string[] = series.length === 1 ? SINGLE_SERIES_COLORS : CHART_SERIES_COLORS;

  useEffect(() => {
    let animation_frame_id = 0;
    let last_legend_refresh_ms = 0;
    const draw_frame = (now_ms: number) => {
      animation_frame_id = requestAnimationFrame(draw_frame);
      const canvas = canvas_ref.current;
      const drawing_context = canvas?.getContext("2d");
      if (!canvas || !drawing_context) return;

      const pixel_ratio = window.devicePixelRatio || 1;
      const css_width = canvas.clientWidth;
      if (canvas.width !== Math.round(css_width * pixel_ratio)) {
        canvas.width = Math.round(css_width * pixel_ratio);
        canvas.height = Math.round(height * pixel_ratio);
      }
      drawing_context.setTransform(pixel_ratio, 0, 0, pixel_ratio, 0, 0);
      drawing_context.clearRect(0, 0, css_width, height);

      // Recessive grid: hairlines at the range ends and at zero, with tick labels.
      const grid_values = [y_maximum, y_minimum, ...(y_minimum < 0 && y_maximum > 0 ? [0] : [])];
      drawing_context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      // The axis band is as wide as its longest label, so labels are never clipped.
      const label_width = Math.max(...grid_values.map((grid_value) => drawing_context.measureText(format_value(grid_value)).width));
      const plot_left = Math.ceil(label_width) + AXIS_LABEL_GAP * 2;
      const plot_width = css_width - plot_left - 6;
      const plot_top = 6;
      const plot_height = height - 12;
      const y_to_pixel = (value: number) =>
        plot_top + (1 - (Math.min(y_maximum, Math.max(y_minimum, value)) - y_minimum) / (y_maximum - y_minimum)) * plot_height;
      drawing_context.lineWidth = 1;
      drawing_context.strokeStyle = CHART_GRID_COLOR;
      drawing_context.fillStyle = CHART_TEXT_MUTED_COLOR;
      drawing_context.textAlign = "right";
      drawing_context.textBaseline = "middle";
      for (const grid_value of grid_values) {
        const grid_y = Math.round(y_to_pixel(grid_value)) + 0.5;
        drawing_context.beginPath();
        drawing_context.moveTo(plot_left, grid_y);
        drawing_context.lineTo(plot_left + plot_width, grid_y);
        drawing_context.stroke();
        drawing_context.fillText(format_value(grid_value), plot_left - AXIS_LABEL_GAP, grid_y);
      }

      const samples = read_samples();
      const window_end_ms = samples.length > 0 ? samples[samples.length - 1]!.time_ms : now_ms;
      const time_to_pixel = (time_ms: number) => plot_left + (1 - (window_end_ms - time_ms) / window_ms) * plot_width;

      series.forEach((chart_series, series_index) => {
        const color = series_colors[series_index] ?? CHART_SINGLE_SERIES_COLOR;
        drawing_context.strokeStyle = color;
        drawing_context.lineWidth = 2;
        drawing_context.lineJoin = "round";
        drawing_context.lineCap = "round";
        drawing_context.beginPath();
        let last_point: [number, number] | null = null;
        for (const sample of samples) {
          const value = sample.values[chart_series.key];
          if (value === undefined || window_end_ms - sample.time_ms > window_ms) continue;
          const point: [number, number] = [time_to_pixel(sample.time_ms), y_to_pixel(value)];
          if (last_point) drawing_context.lineTo(point[0], point[1]);
          else drawing_context.moveTo(point[0], point[1]);
          last_point = point;
        }
        drawing_context.stroke();
        if (last_point) {
          // End dot with a surface ring so overlapping series stay readable.
          drawing_context.beginPath();
          drawing_context.arc(last_point[0], last_point[1], 4, 0, Math.PI * 2);
          drawing_context.fillStyle = color;
          drawing_context.fill();
          drawing_context.lineWidth = 2;
          drawing_context.strokeStyle = CHART_SURFACE_COLOR;
          drawing_context.stroke();
        }
      });

      const hover_x = hover_x_ref.current;
      if (hover_x !== null && hover_x >= plot_left && samples.length > 0) {
        const hover_time_ms = window_end_ms - (1 - (hover_x - plot_left) / plot_width) * window_ms;
        const nearest_sample = samples.reduce((best_sample, sample) =>
          Math.abs(sample.time_ms - hover_time_ms) < Math.abs(best_sample.time_ms - hover_time_ms) ? sample : best_sample,
        );
        const crosshair_x = Math.round(time_to_pixel(nearest_sample.time_ms)) + 0.5;
        drawing_context.strokeStyle = CHART_TEXT_MUTED_COLOR;
        drawing_context.lineWidth = 1;
        drawing_context.beginPath();
        drawing_context.moveTo(crosshair_x, plot_top);
        drawing_context.lineTo(crosshair_x, plot_top + plot_height);
        drawing_context.stroke();
        const seconds_ago = ((window_end_ms - nearest_sample.time_ms) / 1000).toFixed(1);
        const lines = [
          `−${seconds_ago} s`,
          ...series.map((chart_series) => `${chart_series.label}: ${format_value(nearest_sample.values[chart_series.key] ?? 0)}`),
        ];
        set_hover_tooltip((previous_tooltip) =>
          previous_tooltip?.left === crosshair_x && previous_tooltip.lines.join() === lines.join() ? previous_tooltip : { left: crosshair_x, lines },
        );
      }

      if (now_ms - last_legend_refresh_ms > LEGEND_REFRESH_MS) {
        last_legend_refresh_ms = now_ms;
        const latest_sample = samples[samples.length - 1];
        set_latest_values(Object.fromEntries(series.map((chart_series) => [chart_series.key, latest_sample?.values[chart_series.key]])));
      }
    };
    animation_frame_id = requestAnimationFrame(draw_frame);
    return () => cancelAnimationFrame(animation_frame_id);
  }, [series, series_colors, read_samples, window_ms, y_minimum, y_maximum, format_value, height]);

  const format_latest = (key: string) => {
    const value = latest_values[key];
    return value === undefined ? "—" : format_value(value);
  };

  return (
    <figure className="vta-chart">
      <figcaption className="vta-chart__header">
        <span className="vta-chart__title">{title}</span>
        {series.length === 1 && <span className="vta-chart__value">{format_latest(series[0]!.key)}</span>}
      </figcaption>
      {series.length > 1 && (
        <ul className="vta-chart__legend">
          {series.map((chart_series, series_index) => (
            <li key={chart_series.key}>
              <span className="vta-chart__swatch" style={{ background: series_colors[series_index] }} />
              <span>{chart_series.label}</span>
              <span className="vta-chart__value">{format_latest(chart_series.key)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="vta-chart__plot">
        <canvas
          ref={canvas_ref}
          className="vta-chart__canvas"
          style={{ height }}
          role="img"
          aria-label={`${title}: ${series.map((chart_series) => `${chart_series.label} ${format_latest(chart_series.key)}`).join(", ")}`}
          onPointerMove={(pointer_event) => {
            hover_x_ref.current = pointer_event.clientX - pointer_event.currentTarget.getBoundingClientRect().left;
          }}
          onPointerLeave={() => {
            hover_x_ref.current = null;
            set_hover_tooltip(null);
          }}
        />
        {hover_tooltip && (
          <div className="vta-chart__tooltip" style={{ left: hover_tooltip.left }}>
            {hover_tooltip.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
