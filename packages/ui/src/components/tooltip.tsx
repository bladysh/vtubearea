import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  text: string;
  children: ReactNode;
}

interface TooltipPosition {
  left: number;
  top: number;
  is_below: boolean;
}

const VIEWPORT_MARGIN = 8;
const TOOLTIP_MAXIMUM_WIDTH = 260;

/**
 * Hover / focus hint. The native title attribute shows nothing in the macOS
 * WebView, so the bubble is drawn by us, in a portal so panels never clip it.
 */
export function Tooltip({ text, children }: TooltipProps) {
  const tooltip_id = useId();
  const [position, set_position] = useState<TooltipPosition | null>(null);

  const show_tooltip = (target_element: HTMLElement) => {
    const target_rect = target_element.getBoundingClientRect();
    const half_width = TOOLTIP_MAXIMUM_WIDTH / 2;
    const center_x = target_rect.left + target_rect.width / 2;
    const left = Math.min(window.innerWidth - half_width - VIEWPORT_MARGIN, Math.max(half_width + VIEWPORT_MARGIN, center_x));
    const is_below = target_rect.top < 80;
    set_position({ left, top: is_below ? target_rect.bottom + 8 : target_rect.top - 8, is_below });
  };

  return (
    <span
      className="vta-tooltip-anchor"
      aria-describedby={position ? tooltip_id : undefined}
      onPointerEnter={(pointer_event) => show_tooltip(pointer_event.currentTarget)}
      onPointerLeave={() => set_position(null)}
      onFocus={(focus_event) => show_tooltip(focus_event.currentTarget)}
      onBlur={() => set_position(null)}
    >
      {children}
      {position &&
        createPortal(
          <span
            id={tooltip_id}
            role="tooltip"
            className="vta-tooltip"
            data-below={position.is_below}
            style={{ left: position.left, top: position.top, maxWidth: TOOLTIP_MAXIMUM_WIDTH }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
