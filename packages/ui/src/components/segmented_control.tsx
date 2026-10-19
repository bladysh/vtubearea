import type { SelectOption } from "./select_field";

interface SegmentedControlProps<Value extends string> {
  label: string;
  value: Value;
  options: readonly SelectOption<Value>[];
  on_change: (value: Value) => void;
}

export function SegmentedControl<Value extends string>({ label, value, options, on_change }: SegmentedControlProps<Value>) {
  return (
    <div className="vta-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="vta-segmented__option"
          aria-pressed={option.value === value}
          onClick={() => on_change(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
