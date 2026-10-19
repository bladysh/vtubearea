import { useMemo } from "react";
import { LiveLineChart, useTranslate, type TranslationKey } from "@vtubearea/ui";
import { CHART_WINDOW_MS, metric_history } from "../../../app/app_runtime";

const read_samples = () => metric_history.read();
const format_degrees = (value: number) => `${Math.round(value)}°`;
const format_unit = (value: number) => value.toFixed(2);

interface ChartDefinition {
  title_key: TranslationKey;
  series: readonly { key: string; label_key: TranslationKey }[];
  y_minimum: number;
  y_maximum: number;
  format_value: (value: number) => string;
}

const FACE_CHARTS: readonly ChartDefinition[] = [
  {
    title_key: "charts.head",
    series: [
      { key: "FaceAngleX", label_key: "charts.head_turn" },
      { key: "FaceAngleY", label_key: "charts.head_nod" },
      { key: "FaceAngleZ", label_key: "charts.head_tilt" },
    ],
    y_minimum: -40,
    y_maximum: 40,
    format_value: format_degrees,
  },
  {
    title_key: "charts.eyes",
    series: [
      { key: "EyeOpenLeft", label_key: "charts.left" },
      { key: "EyeOpenRight", label_key: "charts.right" },
    ],
    y_minimum: 0,
    y_maximum: 1.2,
    format_value: format_unit,
  },
  {
    title_key: "charts.mouth",
    series: [
      { key: "MouthOpen", label_key: "charts.mouth_open" },
      { key: "MouthSmile", label_key: "charts.mouth_smile" },
    ],
    y_minimum: -1,
    y_maximum: 1,
    format_value: format_unit,
  },
];

const HAND_CHARTS: readonly ChartDefinition[] = [
  {
    title_key: "charts.hand_open",
    series: [
      { key: "HandLeftOpen", label_key: "charts.left" },
      { key: "HandRightOpen", label_key: "charts.right" },
    ],
    y_minimum: 0,
    y_maximum: 1,
    format_value: format_unit,
  },
  {
    title_key: "charts.hand_depth",
    series: [
      { key: "HandLeftDepthOffset", label_key: "charts.left" },
      { key: "HandRightDepthOffset", label_key: "charts.right" },
    ],
    y_minimum: -30,
    y_maximum: 30,
    format_value: (value) => `${Math.round(value)} cm`,
  },
  {
    title_key: "charts.hand_position",
    series: [
      { key: "HandLeftPositionX", label_key: "charts.left" },
      { key: "HandRightPositionX", label_key: "charts.right" },
    ],
    y_minimum: -1,
    y_maximum: 1,
    format_value: format_unit,
  },
];

function ChartList({ chart_definitions }: { chart_definitions: readonly ChartDefinition[] }) {
  const translate = useTranslate();
  // Stable series arrays, so the canvas loop is not restarted on every render.
  const translated_series = useMemo(
    () =>
      chart_definitions.map((chart_definition) =>
        chart_definition.series.map((chart_series) => ({ key: chart_series.key, label: translate(chart_series.label_key) })),
      ),
    [chart_definitions, translate],
  );
  return (
    <div className="chart-list">
      {chart_definitions.map((chart_definition, chart_index) => (
        <LiveLineChart
          key={chart_definition.title_key}
          title={translate(chart_definition.title_key)}
          series={translated_series[chart_index]!}
          read_samples={read_samples}
          window_ms={CHART_WINDOW_MS}
          y_minimum={chart_definition.y_minimum}
          y_maximum={chart_definition.y_maximum}
          format_value={chart_definition.format_value}
        />
      ))}
    </div>
  );
}

export function FaceCharts() {
  return <ChartList chart_definitions={FACE_CHARTS} />;
}

export function HandCharts() {
  return <ChartList chart_definitions={HAND_CHARTS} />;
}
