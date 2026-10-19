import { Field } from "./field";

interface ToggleFieldProps {
  label: string;
  hint?: string;
  is_checked: boolean;
  on_change: (is_checked: boolean) => void;
}

export function ToggleField({ label, hint, is_checked, on_change }: ToggleFieldProps) {
  return (
    <Field
      label={label}
      hint={hint}
      control={
        <button
          type="button"
          role="switch"
          aria-label={label}
          aria-checked={is_checked}
          className="vta-toggle"
          onClick={() => on_change(!is_checked)}
        />
      }
    />
  );
}
