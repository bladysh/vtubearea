import type { ReactNode } from "react";

export interface TabOption<Value extends string> {
  value: Value;
  label: string;
  icon?: ReactNode;
}

interface TabBarProps<Value extends string> {
  label: string;
  value: Value;
  options: readonly TabOption<Value>[];
  on_change: (value: Value) => void;
}

/** Section switcher for long panels: one screen per topic instead of one long scroll. */
export function TabBar<Value extends string>({ label, value, options, on_change }: TabBarProps<Value>) {
  return (
    <div className="vta-tab-bar" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          className="vta-tab-bar__tab"
          aria-selected={option.value === value}
          onClick={() => on_change(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
