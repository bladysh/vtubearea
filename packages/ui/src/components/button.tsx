import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "regular" | "small";
  is_block?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "secondary", size = "regular", is_block = false, icon, className: class_name, children, ...button_props }: ButtonProps) {
  const class_names = [
    "vta-button",
    variant !== "secondary" && `vta-button--${variant}`,
    size === "small" && "vta-button--small",
    is_block && "vta-button--block",
    class_name,
  ];
  return (
    <button type="button" className={class_names.filter(Boolean).join(" ")} {...button_props}>
      {icon}
      {children !== undefined && children !== null && <span className="vta-button__label">{children}</span>}
    </button>
  );
}
