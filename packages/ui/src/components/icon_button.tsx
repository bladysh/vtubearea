import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "./tooltip";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shown as tooltip and read by screen readers. */
  label: string;
  icon: ReactNode;
  is_active?: boolean;
}

export function IconButton({ label, icon, is_active = false, className: class_name, ...button_props }: IconButtonProps) {
  const class_names = ["vta-icon-button", is_active && "vta-icon-button--active", class_name];
  return (
    <Tooltip text={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={is_active}
        className={class_names.filter(Boolean).join(" ")}
        {...button_props}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
