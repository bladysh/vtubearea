interface RangeMeterProps {
  label: string;
  value: number | undefined;
  minimum: number;
  maximum: number;
  format_value: (value: number) => string;
}

/** Current value inside a range: accent fill on a lighter track of the same hue, number beside it. */
export function RangeMeter({ label, value, minimum, maximum, format_value }: RangeMeterProps) {
  const lower_bound = Math.min(minimum, maximum);
  const upper_bound = Math.max(minimum, maximum);
  const span = upper_bound - lower_bound || 1;
  const fill_percent = value === undefined ? 0 : ((Math.min(upper_bound, Math.max(lower_bound, value)) - lower_bound) / span) * 100;
  return (
    <div className="vta-range-meter" role="meter" aria-label={label} aria-valuemin={lower_bound} aria-valuemax={upper_bound} aria-valuenow={value}>
      <span className="vta-range-meter__label">{label}</span>
      <span className="vta-range-meter__track">
        <span className="vta-range-meter__fill" style={{ width: `${fill_percent}%` }} />
      </span>
      <span className="vta-range-meter__value">{value === undefined ? "—" : format_value(value)}</span>
    </div>
  );
}
