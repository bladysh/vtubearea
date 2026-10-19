import type { Graphics } from "pixi.js";

export type CanvasPoint = [number, number];

/** A tracked hand ready to draw: 21 points (MediaPipe order) in model canvas pixels. */
export interface RenderedArm {
  shoulder: CanvasPoint;
  elbow: CanvasPoint;
  wrist: CanvasPoint;
  width: number;
  color: string;
  outline_color: string;
}

export interface RenderedHand {
  points: CanvasPoint[];
  opacity: number;
  /** Drawn under the hand, from the shoulder through the elbow to the wrist. */
  arm?: RenderedArm;
  /** Draw under the head layers (see behind_head_draw_order in the model format). */
  is_behind_head?: boolean;
}

export interface HandStyle {
  skin_color: string;
  outline_color: string;
  outline_width: number;
  /** Finger thickness relative to palm length. */
  finger_width_ratio: number;
}

const WRIST = 0;
const MIDDLE_FINGER_BASE = 9;
const PALM_OUTLINE = [0, 1, 5, 9, 13, 17];
const FINGER_CHAINS: readonly { joints: number[]; width_scale: number }[] = [
  { joints: [1, 2, 3, 4], width_scale: 1.15 },
  { joints: [5, 6, 7, 8], width_scale: 1 },
  { joints: [9, 10, 11, 12], width_scale: 1.05 },
  { joints: [13, 14, 15, 16], width_scale: 1 },
  { joints: [17, 18, 19, 20], width_scale: 0.85 },
];

/**
 * Draws a cartoon hand: outline pass first, then the skin pass on top, so joints
 * merge into one shape with a single clean outline.
 */
export function draw_hand(graphics: Graphics, rendered_hand: RenderedHand, hand_style: HandStyle): void {
  graphics.clear();
  graphics.alpha = rendered_hand.opacity;
  const points = rendered_hand.points;
  if (rendered_hand.opacity <= 0.01 || points.length < 21) return;

  const wrist = points[WRIST]!;
  const middle_finger_base = points[MIDDLE_FINGER_BASE]!;
  const palm_length = Math.hypot(middle_finger_base[0] - wrist[0], middle_finger_base[1] - wrist[1]);
  const finger_width = palm_length * hand_style.finger_width_ratio;
  const palm_polygon = PALM_OUTLINE.flatMap((point_index) => points[point_index]!);

  // The sleeve goes first so the hand outline sits on top of it.
  const arm = rendered_hand.arm;
  if (arm) {
    for (const is_outline_pass of [true, false]) {
      graphics.moveTo(arm.shoulder[0], arm.shoulder[1]).lineTo(arm.elbow[0], arm.elbow[1]).lineTo(arm.wrist[0], arm.wrist[1]);
      graphics.stroke({
        width: arm.width + (is_outline_pass ? hand_style.outline_width * 2 : 0),
        color: is_outline_pass ? arm.outline_color : arm.color,
        cap: "round",
        join: "round",
      });
    }
  }

  for (const is_outline_pass of [true, false]) {
    const color = is_outline_pass ? hand_style.outline_color : hand_style.skin_color;
    const extra_width = is_outline_pass ? hand_style.outline_width * 2 : 0;
    // Thick rounded stroke around the palm polygon makes the palm soft and as wide as the fingers.
    graphics.poly(palm_polygon).fill(color).stroke({ width: finger_width + extra_width, color, join: "round" });
    for (const finger_chain of FINGER_CHAINS) {
      const [first_joint, ...next_joints] = finger_chain.joints.map((point_index) => points[point_index]!);
      graphics.moveTo(first_joint![0], first_joint![1]);
      for (const joint of next_joints) graphics.lineTo(joint[0], joint[1]);
      graphics.stroke({ width: finger_width * finger_chain.width_scale + extra_width, color, cap: "round", join: "round" });
    }
  }
}
