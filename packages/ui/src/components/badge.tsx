import type { ReactNode } from "react";

export type BadgeTone = "success" | "danger" | "neutral" | "accent";

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`vta-badge vta-badge--${tone}`}>{children}</span>;
}
