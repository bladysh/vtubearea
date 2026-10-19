import type { ModelDefinition, ModelGroup, ModelLayer } from "@vtubearea/model-format";
import { compose_local_matrix, IDENTITY_MATRIX, multiply_matrices, type AffineMatrix } from "./affine_matrix";
import { evaluate_node_pose, type ParameterValues } from "./binding_evaluation";

export interface SolvedLayerPose {
  world_matrix: AffineMatrix;
  world_opacity: number;
  /** Offsets in the layer's own space, added to rest vertex positions; null = rest shape. */
  vertex_offsets: Float32Array | null;
}

interface SolvedGroupPose {
  world_matrix: AffineMatrix;
  world_opacity: number;
}

/** Turns parameter values into a world transform per layer by walking the group tree. */
export class ModelPoseSolver {
  private readonly group_by_id: ReadonlyMap<string, ModelGroup>;
  private last_solved_groups = new Map<string, SolvedGroupPose>();

  constructor(private readonly model_definition: ModelDefinition) {
    this.group_by_id = new Map(model_definition.groups.map((group) => [group.id, group]));
  }

  default_parameter_values(): Record<string, number> {
    return Object.fromEntries(
      this.model_definition.parameters.map((parameter) => [parameter.id, parameter.default_value]),
    );
  }

  solve(parameter_values: ParameterValues): Map<string, SolvedLayerPose> {
    const solved_groups = new Map<string, SolvedGroupPose>();
    const solved_layers = new Map<string, SolvedLayerPose>();
    for (const layer of this.model_definition.layers) {
      solved_layers.set(layer.id, this.solve_layer(layer, parameter_values, solved_groups));
    }
    for (const group of this.model_definition.groups) this.solve_group(group.id, parameter_values, solved_groups);
    this.last_solved_groups = solved_groups;
    return solved_layers;
  }

  /** World transform of a group from the latest solve; identity for unknown groups. */
  group_world_matrix(group_id: string): AffineMatrix {
    return this.last_solved_groups.get(group_id)?.world_matrix ?? IDENTITY_MATRIX;
  }

  private solve_layer(
    layer: ModelLayer,
    parameter_values: ParameterValues,
    solved_groups: Map<string, SolvedGroupPose>,
  ): SolvedLayerPose {
    const vertex_value_count = (layer.mesh.columns + 1) * (layer.mesh.rows + 1) * 2;
    const layer_pose = evaluate_node_pose(layer.bindings, parameter_values, vertex_value_count);
    const pivot = layer.pivot ?? [layer.rect.x + layer.rect.width / 2, layer.rect.y + layer.rect.height / 2];
    const local_matrix = compose_local_matrix(
      pivot[0],
      pivot[1],
      layer_pose.translate_x,
      layer_pose.translate_y,
      layer_pose.rotation_degrees,
      layer_pose.scale_x,
      layer_pose.scale_y,
    );
    const parent_pose = this.solve_group(layer.parent_id, parameter_values, solved_groups);
    return {
      world_matrix: multiply_matrices(parent_pose.world_matrix, local_matrix),
      world_opacity: parent_pose.world_opacity * layer_pose.opacity,
      vertex_offsets: layer_pose.vertex_offsets,
    };
  }

  private solve_group(
    group_id: string | undefined,
    parameter_values: ParameterValues,
    solved_groups: Map<string, SolvedGroupPose>,
  ): SolvedGroupPose {
    if (group_id === undefined) return { world_matrix: IDENTITY_MATRIX, world_opacity: 1 };
    const cached_pose = solved_groups.get(group_id);
    if (cached_pose) return cached_pose;

    const group = this.group_by_id.get(group_id);
    if (!group) return { world_matrix: IDENTITY_MATRIX, world_opacity: 1 };

    const group_pose = evaluate_node_pose(group.bindings, parameter_values, 0);
    const local_matrix = compose_local_matrix(
      group.pivot[0],
      group.pivot[1],
      group_pose.translate_x,
      group_pose.translate_y,
      group_pose.rotation_degrees,
      group_pose.scale_x,
      group_pose.scale_y,
    );
    const parent_pose = this.solve_group(group.parent_id, parameter_values, solved_groups);
    const solved_pose = {
      world_matrix: multiply_matrices(parent_pose.world_matrix, local_matrix),
      world_opacity: parent_pose.world_opacity * group_pose.opacity,
    };
    solved_groups.set(group_id, solved_pose);
    return solved_pose;
  }
}
