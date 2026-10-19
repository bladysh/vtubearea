import type { CSSProperties } from "react";
import { Field } from "./field";

interface SliderFieldProps {
  label: string;
  hint?: string;
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  format_value?: (value: number) => string;
  on_change: (value: number) => void;
}

export function SliderField({ label, hint, value, minimum, maximum, step = 0.01, format_value, on_change }: SliderFieldProps) {
  const fill_percent = ((value - minimum) / (maximum - minimum)) * 100;
  const slider_style = { "--vta-slider-fill": `${fill_percent}%` } as CSSProperties;
  return (
    <Field
      label={label}
      hint={hint}
      value_label={format_value ? format_value(value) : value.toFixed(2)}
      is_stacked
      control={
        <input
          className="vta-slider"
          type="range"
          aria-label={label}
          min={minimum}
          max={maximum}
          step={step}
          value={value}
          style={slider_style}
          onChange={(change_event) => on_change(Number(change_event.target.value))}
        />
      }
    />
  );
}
