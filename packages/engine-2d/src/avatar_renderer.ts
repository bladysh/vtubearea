import { Application, Assets, Container, Graphics, Matrix, Mesh, MeshGeometry, type Texture } from "pixi.js";
import type { ModelDefinition, ModelHands, ModelLayer } from "@vtubearea/model-format";
import { transform_point, type AffineMatrix } from "./affine_matrix";
import { draw_hand, type HandStyle, type RenderedHand } from "./hand_drawing";
import type { ParameterValues } from "./binding_evaluation";
import { create_grid_geometry, type GridGeometryData } from "./mesh_grid";
import { ModelPoseSolver, type SolvedLayerPose } from "./model_pose_solver";
import { PaintedArmView } from "./painted_arm";

export interface AvatarRendererOptions {
  host_element: HTMLElement;
  max_frames_per_second: number;
  antialias: boolean;
}

/** Where the model sits in the viewport. Offsets are in viewport pixels from the center. */
export interface ModelViewTransform {
  offset_x: number;
  offset_y: number;
  /** 1 = model canvas height fits the viewport height. */
  zoom: number;
}

export type TextureUrlResolver = (relative_texture_path: string) => string;

/** One hand on screen: drawn from tracked points, or painted arm images. */
interface HandDisplay {
  container: Container;
  show(rendered_hand: RenderedHand): void;
}

interface RenderedLayer {
  layer: ModelLayer;
  grid_geometry: GridGeometryData;
  meshes: Mesh[];
  had_vertex_offsets: boolean;
}

/** PixiJS renderer for one 2D model. Knows nothing about tracking, only parameter values. */
export class AvatarRenderer {
  private readonly model_container = new Container();
  private rendered_layers: RenderedLayer[] = [];
  private pose_solver: ModelPoseSolver | null = null;
  private model_definition: ModelDefinition | null = null;
  private view_transform: ModelViewTransform = { offset_x: 0, offset_y: 0, zoom: 1 };
  private hand_displays: HandDisplay[] = [];
  /** Child index where a hand behind the head goes; null = always on top. */
  private behind_head_child_index: number | null = null;

  private constructor(private readonly application: Application) {
    application.stage.addChild(this.model_container);
    application.renderer.on("resize", () => this.apply_view_transform());
  }

  static async create(options: AvatarRendererOptions): Promise<AvatarRenderer> {
    const application = new Application();
    await application.init({
      resizeTo: options.host_element,
      backgroundAlpha: 0,
      antialias: options.antialias,
      autoDensity: true,
      resolution: window.devicePixelRatio,
      preference: "webgl",
    });
    application.ticker.maxFPS = options.max_frames_per_second;
    options.host_element.appendChild(application.canvas);
    return new AvatarRenderer(application);
  }

  get canvas(): HTMLCanvasElement {
    return this.application.canvas;
  }

  get frames_per_second(): number {
    return this.application.ticker.FPS;
  }

  set_max_frames_per_second(value: number): void {
    this.application.ticker.maxFPS = value;
  }

  /** Runs before every rendered frame; return value of the callback is ignored. */
  on_before_render(callback: (delta_seconds: number) => void): () => void {
    const ticker_callback = () => callback(this.application.ticker.deltaMS / 1000);
    this.application.ticker.add(ticker_callback);
    return () => this.application.ticker.remove(ticker_callback);
  }

  async load_model(model_definition: ModelDefinition, resolve_texture_url: TextureUrlResolver): Promise<void> {
    this.unload_model();
    const texture_by_path = await load_textures(
      [...model_definition.layers.map((layer) => layer.texture), ...painted_arm_texture_paths(model_definition.hands)],
      resolve_texture_url,
    );
    const layer_by_id = new Map(model_definition.layers.map((layer) => [layer.id, layer]));
    const sorted_layers = [...model_definition.layers].sort((first, second) => first.draw_order - second.draw_order);

    for (const layer of sorted_layers) {
      const visible_mesh = create_layer_mesh(layer, texture_by_path.get(layer.texture)!);
      this.model_container.addChild(visible_mesh.mesh);
      this.rendered_layers.push({
        layer,
        grid_geometry: visible_mesh.grid_geometry,
        meshes: [visible_mesh.mesh],
        had_vertex_offsets: false,
      });
    }

    // A mask is a hidden copy of the mask layer that follows the same pose every frame.
    for (const rendered_layer of [...this.rendered_layers]) {
      const mask_layer = rendered_layer.layer.mask_layer_id
        ? layer_by_id.get(rendered_layer.layer.mask_layer_id)
        : undefined;
      if (!mask_layer) continue;
      const mask_mesh = create_layer_mesh(mask_layer, texture_by_path.get(mask_layer.texture)!);
      this.model_container.addChild(mask_mesh.mesh);
      rendered_layer.meshes[0]!.mask = mask_mesh.mesh;
      this.rendered_layers.push({
        layer: mask_layer,
        grid_geometry: mask_mesh.grid_geometry,
        meshes: [mask_mesh.mesh],
        had_vertex_offsets: false,
      });
    }

    // Tracked hands are drawn above every model layer.
    this.hand_displays = model_definition.hands ? [0, 1].map(() => create_hand_display(model_definition.hands!, texture_by_path)) : [];
    for (const hand_display of this.hand_displays) this.model_container.addChild(hand_display.container);
    const behind_head_draw_order = model_definition.hands?.behind_head_draw_order;
    // Visible layers were added first in draw order, so this count is the insertion index.
    this.behind_head_child_index =
      behind_head_draw_order === undefined ? null : sorted_layers.filter((layer) => layer.draw_order < behind_head_draw_order).length;

    this.model_definition = model_definition;
    this.pose_solver = new ModelPoseSolver(model_definition);
    this.apply_parameter_values(this.pose_solver.default_parameter_values());
    this.apply_view_transform();
  }

  unload_model(): void {
    for (const child of this.model_container.removeChildren()) child.destroy();
    this.rendered_layers = [];
    this.hand_displays = [];
    this.behind_head_child_index = null;
    this.pose_solver = null;
    this.model_definition = null;
  }

  /** A canvas point moved the way a group moved in the latest frame (e.g. a face anchor following the head). */
  transform_point_by_group(group_id: string | undefined, point: readonly [number, number]): [number, number] {
    if (!group_id || !this.pose_solver) return [point[0], point[1]];
    return transform_point(this.pose_solver.group_world_matrix(group_id), point[0], point[1]);
  }

  /** Up to two hands; missing entries clear the matching hand. No-op for models without hands. */
  apply_hands(rendered_hands: readonly RenderedHand[]): void {
    this.hand_displays.forEach((hand_display, hand_index) => {
      const rendered_hand = rendered_hands[hand_index] ?? { points: [], opacity: 0 };
      this.place_hand_container(hand_display.container, rendered_hand.is_behind_head === true);
      hand_display.show(rendered_hand);
    });
  }

  /** Moves a hand between "under the head" and "on top" without rebuilding anything. */
  private place_hand_container(container: Container, is_behind_head: boolean): void {
    const current_index = this.model_container.getChildIndex(container);
    const top_index = this.model_container.children.length - 1;
    if (is_behind_head && this.behind_head_child_index !== null) {
      // The other hand may sit in the slot already; behind hands share it.
      const target_index = Math.min(this.behind_head_child_index, top_index);
      if (current_index > target_index + 1 || current_index < target_index) this.model_container.setChildIndex(container, target_index);
    } else if (current_index < top_index - 1) {
      this.model_container.setChildIndex(container, top_index);
    }
  }

  apply_parameter_values(parameter_values: ParameterValues): void {
    if (!this.pose_solver) return;
    const solved_layers = this.pose_solver.solve(parameter_values);
    for (const rendered_layer of this.rendered_layers) {
      const layer_pose = solved_layers.get(rendered_layer.layer.id);
      if (layer_pose) apply_layer_pose(rendered_layer, layer_pose);
    }
  }

  set_view_transform(view_transform: ModelViewTransform): void {
    this.view_transform = view_transform;
    this.apply_view_transform();
  }

  destroy(): void {
    this.unload_model();
    this.application.destroy(true, { children: true });
  }

  private apply_view_transform(): void {
    if (!this.model_definition) return;
    const { width: viewport_width, height: viewport_height } = this.application.screen;
    const { width: canvas_width, height: canvas_height } = this.model_definition.canvas;
    const scale = (viewport_height / canvas_height) * this.view_transform.zoom;
    this.model_container.scale.set(scale);
    this.model_container.position.set(
      viewport_width / 2 + this.view_transform.offset_x - (canvas_width * scale) / 2,
      viewport_height / 2 + this.view_transform.offset_y - (canvas_height * scale) / 2,
    );
  }
}

/** Textures by their model-relative path, each loaded once. */
async function load_textures(texture_paths: readonly string[], resolve_texture_url: TextureUrlResolver): Promise<Map<string, Texture>> {
  const loaded_textures = await Promise.all(
    [...new Set(texture_paths)].map(async (texture_path) => {
      // SVG is rasterized once; 2x keeps it sharp when the model is zoomed in. Mipmaps stop
      // detailed painted textures from shimmering when the model is shown small.
      const texture: Texture = await Assets.load({ src: resolve_texture_url(texture_path), data: { resolution: 2, autoGenerateMipmaps: true } });
      return [texture_path, texture] as const;
    }),
  );
  return new Map(loaded_textures);
}

function painted_arm_texture_paths(model_hands: ModelHands | undefined): string[] {
  const arm_art = model_hands?.arms?.art;
  if (!arm_art) return [];
  const articulated_hands = arm_art.articulated_hands ? [arm_art.articulated_hands.palm_side, arm_art.articulated_hands.back_side] : [];
  const articulated_textures = articulated_hands.flatMap((articulated_hand) =>
    articulated_hand ? [articulated_hand.palm.texture, ...articulated_hand.fingers.flat().map((finger_bone) => finger_bone.texture)] : [],
  );
  return [arm_art.upper_arm.texture, arm_art.forearm.texture, ...arm_art.hand_poses.map((hand_pose) => hand_pose.texture), ...articulated_textures];
}

function create_hand_display(model_hands: ModelHands, texture_by_path: ReadonlyMap<string, Texture>): HandDisplay {
  const arms = model_hands.arms;
  if (arms?.art) {
    const painted_arm_view = new PaintedArmView(arms.art, texture_by_path, (arms.left_shoulder[0] + arms.right_shoulder[0]) / 2, model_hands);
    return { container: painted_arm_view.container, show: (rendered_hand) => painted_arm_view.update(rendered_hand) };
  }
  const graphics = new Graphics();
  const hand_style: HandStyle = model_hands;
  return { container: graphics, show: (rendered_hand) => draw_hand(graphics, rendered_hand, hand_style) };
}

function create_layer_mesh(layer: ModelLayer, texture: Texture) {
  const grid_geometry = create_grid_geometry(layer.rect, layer.mesh.columns, layer.mesh.rows);
  const geometry = new MeshGeometry({
    positions: grid_geometry.rest_positions.slice(),
    uvs: grid_geometry.uvs,
    indices: grid_geometry.indices,
  });
  return { grid_geometry, mesh: new Mesh({ geometry, texture }) };
}

function apply_layer_pose(rendered_layer: RenderedLayer, layer_pose: SolvedLayerPose): void {
  const world_matrix = to_pixi_matrix(layer_pose.world_matrix);
  const needs_vertex_update = layer_pose.vertex_offsets !== null || rendered_layer.had_vertex_offsets;
  for (const mesh of rendered_layer.meshes) {
    mesh.setFromMatrix(world_matrix);
    mesh.alpha = layer_pose.world_opacity;
    if (needs_vertex_update) write_vertex_positions(mesh, rendered_layer.grid_geometry, layer_pose.vertex_offsets);
  }
  rendered_layer.had_vertex_offsets = layer_pose.vertex_offsets !== null;
}

function write_vertex_positions(mesh: Mesh, grid_geometry: GridGeometryData, vertex_offsets: Float32Array | null) {
  const positions = (mesh.geometry as MeshGeometry).positions;
  const rest_positions = grid_geometry.rest_positions;
  for (let value_index = 0; value_index < rest_positions.length; value_index += 1) {
    positions[value_index] = rest_positions[value_index]! + (vertex_offsets?.[value_index] ?? 0);
  }
  mesh.geometry.getBuffer("aPosition").update();
}

function to_pixi_matrix(matrix: AffineMatrix): Matrix {
  return new Matrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);
}
