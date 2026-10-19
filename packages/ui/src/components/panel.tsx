import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  subtitle?: string;
  /** Next to the title: status chips, a main action. */
  header_actions?: ReactNode;
  /** Under the title: usually a TabBar. Stays visible while the body scrolls. */
  toolbar?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, header_actions, toolbar, className: class_name, children }: PanelProps) {
  return (
    <section className={["vta-panel", class_name].filter(Boolean).join(" ")}>
      <header className="vta-panel__header">
        <div className="vta-panel__title-row">
          <h2 className="vta-panel__title">{title}</h2>
          {header_actions}
        </div>
        {subtitle && <p className="vta-panel__subtitle">{subtitle}</p>}
        {toolbar && <div className="vta-panel__toolbar">{toolbar}</div>}
      </header>
      <div className="vta-panel__body">{children}</div>
    </section>
  );
}

interface SectionProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({ title, actions, children }: SectionProps) {
  return (
    <div className="vta-section">
      {(title || actions) && (
        <div className="vta-field__row">
          {title && <h3 className="vta-section__title">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
