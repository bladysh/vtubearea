import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Tooltip } from "./tooltip";

interface FieldProps {
  label: string;
  /** Plain-language explanation shown on hover, so settings work without docs. */
  hint?: string;
  value_label?: string;
  control: ReactNode;
  /** Put the control under the label instead of on the same row. */
  is_stacked?: boolean;
}

export function Field({ label, hint, value_label, control, is_stacked = false }: FieldProps) {
  const label_row = (
    <div className="vta-field__row">
      <span className="vta-field__label">
        {label}
        {hint && (
          <Tooltip text={hint}>
            <span className="vta-field__help" tabIndex={0} aria-label={hint}>
              <CircleHelp size={13} />
            </span>
          </Tooltip>
        )}
      </span>
      {value_label !== undefined && <span className="vta-field__value">{value_label}</span>}
      {!is_stacked && control}
    </div>
  );
  return (
    <div className="vta-field">
      {label_row}
      {is_stacked && control}
    </div>
  );
}
