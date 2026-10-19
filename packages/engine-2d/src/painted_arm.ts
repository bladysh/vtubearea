import { Container, Graphics, Matrix, Mesh, MeshGeometry, type Texture } from "pixi.js";
import type { PaintedArms } from "@vtubearea/model-format";
import { multiply_matrices, IDENTITY_MATRIX, type AffineMatrix } from "./affine_matrix";
import { draw_hand, type CanvasPoint, type HandStyle, type RenderedHand } from "./hand_drawing";
import { create_grid_geometry, type GridRect } from "./mesh_grid";

/** Wrist, index finger base and pinky base: enough to orient a painted hand. */
export interface HandFrame {
  wrist: CanvasPoint;
  index_base: CanvasPoint;
  pinky_base: CanvasPoint;
}

/** x -> 2 * axis_x - x: turns the painted right arm into the left one. */
export function mirror_matrix(axis_x: number): AffineMatrix {
  return { a: -1, b: 0, c: 0, d: 1, tx: 2 * axis_x, ty: 0 };
}

export function mirror_point(point: CanvasPoint, axis_x: number): CanvasPoint {
  return [2 * axis_x - point[0], point[1]];
}

/**
 * Maps a painted bone from its rest joints onto solved joints: turned to the new direction and
 * stretched only along its length, so the sleeve keeps its painted width.
 */
export function bone_matrix(rest_start: CanvasPoint, rest_end: CanvasPoint, start: CanvasPoint, end: CanvasPoint): AffineMatrix {
  const rest_length = Math.max(Math.hypot(rest_end[0] - rest_start[0], rest_end[1] - rest_start[1]), 1e-6);
  const length = Math.max(Math.hypot(end[0] - start[0], end[1] - start[1]), 1e-6);
  const [rest_x, rest_y] = [(rest_end[0] - rest_start[0]) / rest_length, (rest_end[1] - rest_start[1]) / rest_length];
  const [target_x, target_y] = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
  const stretch = length / rest_length;
  // Rotate the rest direction onto the target direction, stretching along it: U * stretch * u^T + V * v^T.
  const linear = {
    a: stretch * target_x * rest_x + target_y * rest_y,
    b: stretch * target_y * rest_x - target_x * rest_y,
    c: stretch * target_x * rest_y - target_y * rest_x,
    d: stretch * target_y * rest_y + target_x * rest_x,
  };
  return {
    ...linear,
    tx: start[0] - (linear.a * rest_start[0] + linear.c * rest_start[1]),
    ty: start[1] - (linear.b * rest_start[0] + linear.d * rest_start[1]),
  };
}

/**
 * Turns a painted hand so its wrist sits on the target wrist and its fingers point where the
 * tracked fingers point. Keeps the painted size. When the tracked thumb is on the other side
 * (palm vs back of the hand), the image is flipped along its own axis.
 */
export function hand_pose_matrix(rest_frame: HandFrame, target_frame: HandFrame): AffineMatrix {
  const rest_axis = palm_axis(rest_frame);
  const target_axis = palm_axis(target_frame);
  const rest_angle = Math.atan2(rest_axis[1], rest_axis[0]);
  const rotation = Math.atan2(target_axis[1], target_axis[0]) - rest_angle;
  const is_flipped = thumb_side(rest_frame, rest_axis) !== thumb_side(target_frame, target_axis);
  const reflection: AffineMatrix = is_flipped
    ? { a: Math.cos(2 * rest_angle), b: Math.sin(2 * rest_angle), c: Math.sin(2 * rest_angle), d: -Math.cos(2 * rest_angle), tx: 0, ty: 0 }
    : IDENTITY_MATRIX;
  const turn: AffineMatrix = { a: Math.cos(rotation), b: Math.sin(rotation), c: -Math.sin(rotation), d: Math.cos(rotation), tx: 0, ty: 0 };
  const linear = multiply_matrices(turn, reflection);
  const [rest_wrist_x, rest_wrist_y] = rest_frame.wrist;
  return {
    ...linear,
    tx: target_frame.wrist[0] - (linear.a * rest_wrist_x + linear.c * rest_wrist_y),
    ty: target_frame.wrist[1] - (linear.b * rest_wrist_x + linear.d * rest_wrist_y),
  };
}

/** Wrist toward the middle of the knuckles. */
function palm_axis(frame: HandFrame): CanvasPoint {
  return [
    (frame.index_base[0] + frame.pinky_base[0]) / 2 - frame.wrist[0],
    (frame.index_base[1] + frame.pinky_base[1]) / 2 - frame.wrist[1],
  ];
}

function thumb_side(frame: HandFrame, axis: CanvasPoint): boolean {
  const across: CanvasPoint = [frame.index_base[0] - frame.pinky_base[0], frame.index_base[1] - frame.pinky_base[1]];
  return axis[0] * across[1] - axis[1] * across[0] > 0;
}

/** Meshes of one painted arm: upper arm, every hand pose (one shown at a time), forearm over the wrist. */
export class PaintedArmView {
  readonly container = new Container();
  private readonly upper_arm_mesh: Mesh;
  private readonly forearm_mesh: Mesh;
  private readonly hand_meshes = new Map<string, Mesh>();
  /** A hand drawn from tracked points: its wrist goes under the sleeve, the palm and fingers over it. */
  private readonly drawn_wrist = new Graphics();
  private readonly drawn_hand = new Graphics();

  constructor(
    private readonly arm_art: PaintedArms,
    texture_by_path: ReadonlyMap<string, Texture>,
    /** Middle between the shoulders: the left arm mirrors the painted right one around it. */
    private readonly mirror_axis_x: number,
    /** Colors for a hand drawn from tracked points (pose_id null). */
    private readonly hand_style: HandStyle,
  ) {
    this.upper_arm_mesh = create_part_mesh(arm_art.upper_arm.rect, texture_by_path.get(arm_art.upper_arm.texture)!);
    this.container.addChild(this.upper_arm_mesh);
    for (const hand_pose of arm_art.hand_poses) {
      const hand_mesh = create_part_mesh(hand_pose.rect, texture_by_path.get(hand_pose.texture)!);
      this.hand_meshes.set(hand_pose.id, hand_mesh);
      this.container.addChild(hand_mesh);
    }
    this.container.addChild(this.drawn_wrist);
    // The sleeve cuff covers the wrist end of every hand image.
    this.forearm_mesh = create_part_mesh(arm_art.forearm.rect, texture_by_path.get(arm_art.forearm.texture)!);
    this.container.addChild(this.forearm_mesh);
    this.container.addChild(this.drawn_hand);
  }

  update(rendered_hand: RenderedHand): void {
    const arm = rendered_hand.arm;
    const painted_hand = rendered_hand.painted_hand;
    this.container.visible = Boolean(arm && painted_hand);
    if (!arm || !painted_hand) return;
    const is_mirrored = painted_hand.is_mirrored;
    const to_side = (point: CanvasPoint) => (is_mirrored ? mirror_point(point, this.mirror_axis_x) : point);
    const side_matrix = is_mirrored ? mirror_matrix(this.mirror_axis_x) : IDENTITY_MATRIX;
    const { upper_arm, forearm } = this.arm_art;
    set_matrix(this.upper_arm_mesh, multiply_matrices(bone_matrix(to_side(upper_arm.start), to_side(upper_arm.end), arm.shoulder, arm.elbow), side_matrix));
    set_matrix(this.forearm_mesh, multiply_matrices(bone_matrix(to_side(forearm.start), to_side(forearm.end), arm.elbow, arm.wrist), side_matrix));
    if (painted_hand.pose_id === null) {
      const drawn = { points: rendered_hand.points, opacity: 1, arm };
      draw_hand(this.drawn_wrist, drawn, this.hand_style, "wrist");
      draw_hand(this.drawn_hand, drawn, this.hand_style, "palm_and_fingers");
    } else {
      this.drawn_wrist.clear();
      this.drawn_hand.clear();
    }
    for (const hand_pose of this.arm_art.hand_poses) {
      const hand_mesh = this.hand_meshes.get(hand_pose.id)!;
      hand_mesh.visible = hand_pose.id === painted_hand.pose_id;
      if (!hand_mesh.visible) continue;
      const rest_frame: HandFrame = { wrist: to_side(hand_pose.wrist), index_base: to_side(hand_pose.index_base), pinky_base: to_side(hand_pose.pinky_base) };
      set_matrix(hand_mesh, multiply_matrices(hand_pose_matrix(rest_frame, painted_hand), side_matrix));
    }
  }
}

function create_part_mesh(rect: GridRect, texture: Texture): Mesh {
  const grid_geometry = create_grid_geometry(rect, 1, 1);
  return new Mesh({ geometry: new MeshGeometry({ positions: grid_geometry.rest_positions, uvs: grid_geometry.uvs, indices: grid_geometry.indices }), texture });
}

function set_matrix(mesh: Mesh, matrix: AffineMatrix): void {
  mesh.setFromMatrix(new Matrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty));
}
