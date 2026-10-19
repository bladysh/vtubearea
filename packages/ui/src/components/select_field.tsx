import { Field } from "./field";

export interface SelectOption<Value extends string> {
  value: Value;
  label: string;
}

interface SelectFieldProps<Value extends string> {
  label: string;
  hint?: string;
  value: Value;
  options: readonly SelectOption<Value>[];
  on_change: (value: Value) => void;
}

export function SelectField<Value extends string>({ label, hint, value, options, on_change }: SelectFieldProps<Value>) {
  return (
    <Field
      label={label}
      hint={hint}
      is_stacked
      control={
        <select
          className="vta-select"
          aria-label={label}
          value={value}
          onChange={(change_event) => on_change(change_event.target.value as Value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      }
    />
  );
}
