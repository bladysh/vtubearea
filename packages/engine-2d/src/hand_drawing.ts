import type { Graphics } from "pixi.js";

export type CanvasPoint = [number, number];

/**
 * How a painted arm shows its hand: a painted pose image, a hand drawn from the tracked points,
 * or the model's articulated painted hand (every finger follows).
 */
export type PaintedHandChoice = { kind: "sprite"; pose_id: string } | { kind: "drawn" } | { kind: "articulated" };

export interface RenderedArm {
  shoulder: CanvasPoint;
  elbow: CanvasPoint;
  wrist: CanvasPoint;
  width: number;
  color: string;
  outline_color: string;
}

/** A tracked hand ready to draw: 21 points (MediaPipe order) in model canvas pixels. */
export interface RenderedHand {
  points: CanvasPoint[];
  opacity: number;
  /** Drawn under the hand, from the shoulder through the elbow to the wrist. */
  arm?: RenderedArm;
  /** Draw under the head layers (see behind_head_draw_order in the model format). */
  is_behind_head?: boolean;
  /** Models with painted arms: which hand image to show and where it goes. */
  painted_hand?: {
    hand: PaintedHandChoice;
    wrist: CanvasPoint;
    index_base: CanvasPoint;
    pinky_base: CanvasPoint;
    /** The model's left arm: the painted right arm mirrored. */
    is_mirrored: boolean;
  };
}

export interface HandStyle {
  skin_color: string;
  outline_color: string;
  outline_width: number;
  /** Finger thickness relative to palm length. */
  finger_width_ratio: number;
}

const WRIST = 0;
/** Fingertips are this much narrower than finger bases. */
const FINGER_TIP_TAPER = 0.3;
/** A real wrist is about 80% as wide as the palm across the knuckles; the palm tapers into it. */
const WRIST_TO_PALM_WIDTH = 0.8;
/** Wrist drawn back from the palm (share of palm length) and its half-width (share of palm width). */
const WRIST_LENGTH_RATIO = 0.45;
const WRIST_WIDTH_RATIO = 0.4;
const MIDDLE_FINGER_BASE = 9;
/** Palm corners from the thumb base around the knuckles (MediaPipe order). */
const PALM_KNUCKLES = [1, 5, 9, 13, 17];
const FINGER_CHAINS: readonly { joints: number[]; width_scale: number }[] = [
  { joints: [1, 2, 3, 4], width_scale: 1.15 },
  { joints: [5, 6, 7, 8], width_scale: 1 },
  { joints: [9, 10, 11, 12], width_scale: 1.05 },
  { joints: [13, 14, 15, 16], width_scale: 1 },
  { joints: [17, 18, 19, 20], width_scale: 0.85 },
];

/** Which pieces to draw: everything, or the wrist and the hand separately for layering. */
export type HandDrawingPart = "whole" | "wrist" | "palm_and_fingers";

/**
 * Draws a cartoon hand: outline pass first, then the skin pass on top, so joints merge into
 * one shape with a single clean outline. With an arm the layers go upper arm, wrist, forearm
 * sleeve, then palm and fingers: only the wrist ever hides under the cuff, the moving hand
 * stays on top of the sleeve.
 */
export function draw_hand(graphics: Graphics, rendered_hand: RenderedHand, hand_style: HandStyle, part: HandDrawingPart = "whole"): void {
  graphics.clear();
  graphics.alpha = rendered_hand.opacity;
  const points = rendered_hand.points;
  if (rendered_hand.opacity <= 0.01 || points.length < 21) return;

  const wrist = points[WRIST]!;
  const middle_finger_base = points[MIDDLE_FINGER_BASE]!;
  const palm_length = Math.hypot(middle_finger_base[0] - wrist[0], middle_finger_base[1] - wrist[1]);
  const finger_width = palm_length * hand_style.finger_width_ratio;
  const index_base = points[5]!;
  const pinky_base = points[17]!;
  const palm_width = Math.hypot(index_base[0] - pinky_base[0], index_base[1] - pinky_base[1]);
  const arm = rendered_hand.arm;
  const sleeve_pass = (start: CanvasPoint, end: CanvasPoint, cap: "round" | "butt") => {
    for (const is_outline_pass of [true, false]) {
      graphics.moveTo(start[0], start[1]).lineTo(end[0], end[1]);
      graphics.stroke({ width: arm!.width + (is_outline_pass ? hand_style.outline_width * 2 : 0), color: is_outline_pass ? arm!.outline_color : arm!.color, cap });
    }
  };
  const skin_passes = (draw_shapes: (color: string, extra_width: number) => void) => {
    for (const is_outline_pass of [true, false]) {
      draw_shapes(is_outline_pass ? hand_style.outline_color : hand_style.skin_color, is_outline_pass ? hand_style.outline_width * 2 : 0);
    }
  };

  const draw_wrist = () => {
    // A wrist that continues back from the palm, as wide as a real one, so it meets the sleeve
    // cuff without a thin neck that flickers when the hand turns. With an arm it runs up the
    // forearm and stays narrower than the sleeve, so the cuff drawn over it always hides it.
    const [toward_x, toward_y] = arm ? [arm.elbow[0] - wrist[0], arm.elbow[1] - wrist[1]] : [wrist[0] - middle_finger_base[0], wrist[1] - middle_finger_base[1]];
    const toward_length = Math.max(Math.hypot(toward_x, toward_y), 1e-6);
    const wrist_back: CanvasPoint = [
      wrist[0] + (toward_x / toward_length) * palm_length * WRIST_LENGTH_RATIO,
      wrist[1] + (toward_y / toward_length) * palm_length * WRIST_LENGTH_RATIO,
    ];
    const wrist_radius = Math.min(Math.max(palm_width, palm_length * 0.6) * WRIST_WIDTH_RATIO, arm ? arm.width * 0.45 : Infinity);
    skin_passes((color, extra_width) => {
      graphics.circle(wrist_back[0], wrist_back[1], wrist_radius * 0.92 + extra_width / 2).fill(color);
      graphics.poly(tapered_segment(wrist, wrist_back, wrist_radius + extra_width / 2, wrist_radius * 0.92 + extra_width / 2)).fill(color);
    });
  };

  const draw_palm_and_fingers = () => {
    // The wrist edge runs across the hand axis; its corners close the palm on each side.
    const axis_x = (middle_finger_base[0] - wrist[0]) / Math.max(palm_length, 1e-6);
    const axis_y = (middle_finger_base[1] - wrist[1]) / Math.max(palm_length, 1e-6);
    const thumb_side = Math.sign(axis_x * (index_base[1] - wrist[1]) - axis_y * (index_base[0] - wrist[0])) || 1;
    // A hand seen edge-on keeps some width instead of collapsing to a line.
    const visible_palm_width = Math.max(palm_width, palm_length * 0.55);
    // The rounded stroke below adds half a finger on each side, so it is taken off here.
    const wrist_half_width = Math.max(0, (visible_palm_width * WRIST_TO_PALM_WIDTH - finger_width) / 2);
    const [normal_x, normal_y] = [-axis_y * thumb_side * wrist_half_width, axis_x * thumb_side * wrist_half_width];
    const palm_polygon = [
      wrist[0] + normal_x, wrist[1] + normal_y,
      ...PALM_KNUCKLES.flatMap((point_index) => points[point_index]!),
      wrist[0] - normal_x, wrist[1] - normal_y,
    ];
    skin_passes((color, extra_width) => {
      // Thick rounded stroke around the palm polygon makes the palm soft and as wide as the fingers.
      graphics.poly(palm_polygon).fill(color).stroke({ width: finger_width + extra_width, color, join: "round" });
      for (const finger_chain of FINGER_CHAINS) {
        const joints = finger_chain.joints.map((point_index) => points[point_index]!);
        const base_width = finger_width * finger_chain.width_scale;
        // Fingers taper toward the tip, which reads as a hand rather than a bundle of tubes.
        const radii = joints.map((_, joint_index) => (base_width * (1 - FINGER_TIP_TAPER * (joint_index / (joints.length - 1))) + extra_width) / 2);
        joints.forEach((joint, joint_index) => {
          graphics.circle(joint[0], joint[1], radii[joint_index]!).fill(color);
          const next_joint = joints[joint_index + 1];
          if (next_joint) graphics.poly(tapered_segment(joint, next_joint, radii[joint_index]!, radii[joint_index + 1]!)).fill(color);
        });
      }
    });
  };

  if (part === "wrist") return draw_wrist();
  if (part === "palm_and_fingers") return draw_palm_and_fingers();
  if (arm) sleeve_pass(arm.shoulder, arm.elbow, "round");
  draw_wrist();
  if (arm) {
    // A flat end at the wrist: the cuff stops where the hand starts.
    sleeve_pass(arm.elbow, arm.wrist, "butt");
    // Covers the forearm's flat outline end at the elbow, so the joint reads as one round sleeve.
    graphics.circle(arm.elbow[0], arm.elbow[1], arm.width / 2).fill(arm.color);
  }
  draw_palm_and_fingers();
}

/** Quad joining two joint circles of different radii (their outer tangents, near enough for thin fingers). */
function tapered_segment(start: CanvasPoint, end: CanvasPoint, start_radius: number, end_radius: number): number[] {
  const length = Math.max(Math.hypot(end[0] - start[0], end[1] - start[1]), 1e-6);
  const [normal_x, normal_y] = [-(end[1] - start[1]) / length, (end[0] - start[0]) / length];
  return [
    start[0] + normal_x * start_radius, start[1] + normal_y * start_radius,
    end[0] + normal_x * end_radius, end[1] + normal_y * end_radius,
    end[0] - normal_x * end_radius, end[1] - normal_y * end_radius,
    start[0] - normal_x * start_radius, start[1] - normal_y * start_radius,
  ];
}
