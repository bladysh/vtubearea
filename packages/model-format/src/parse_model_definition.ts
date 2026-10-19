import { model_definition_schema, type ModelDefinition, type ParameterBinding } from "./model_definition_schema";

export type ModelParseResult =
  | { success: true; model_definition: ModelDefinition }
  | { success: false; problems: string[] };

/** Parses untrusted model.json content: schema first, then cross-references. */
export function parse_model_definition(raw_json: unknown): ModelParseResult {
  const schema_result = model_definition_schema.safeParse(raw_json);
  if (!schema_result.success) {
    return {
      success: false,
      problems: schema_result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  const problems = find_reference_problems(schema_result.data);
  return problems.length > 0
    ? { success: false, problems }
    : { success: true, model_definition: schema_result.data };
}

function find_reference_problems(model_definition: ModelDefinition): string[] {
  const problems: string[] = [];
  const parameter_ids = new Set<string>();
  const node_ids = new Set<string>();
  const group_ids = new Set(model_definition.groups.map((group) => group.id));
  const layer_ids = new Set(model_definition.layers.map((layer) => layer.id));

  for (const parameter of model_definition.parameters) {
    if (parameter_ids.has(parameter.id)) problems.push(`parameters: duplicate id "${parameter.id}"`);
    parameter_ids.add(parameter.id);
    const is_default_in_range =
      parameter.minimum <= parameter.default_value && parameter.default_value <= parameter.maximum;
    if (!is_default_in_range) {
      problems.push(`parameters.${parameter.id}: default_value must be within minimum..maximum`);
    }
  }

  for (const node of [...model_definition.groups, ...model_definition.layers]) {
    if (node_ids.has(node.id)) problems.push(`duplicate node id "${node.id}"`);
    node_ids.add(node.id);
    if (node.parent_id !== undefined && !group_ids.has(node.parent_id)) {
      problems.push(`${node.id}: parent_id "${node.parent_id}" is not a group`);
    }
  }

  problems.push(...find_parent_cycles(model_definition));

  for (const group of model_definition.groups) {
    for (const binding of group.bindings) {
      problems.push(...check_binding(group.id, binding, parameter_ids, undefined));
    }
  }

  for (const layer of model_definition.layers) {
    const vertex_count = (layer.mesh.columns + 1) * (layer.mesh.rows + 1);
    for (const binding of layer.bindings) {
      problems.push(...check_binding(layer.id, binding, parameter_ids, vertex_count));
    }
    if (layer.mask_layer_id !== undefined && !layer_ids.has(layer.mask_layer_id)) {
      problems.push(`${layer.id}: mask_layer_id "${layer.mask_layer_id}" is not a layer`);
    }
    if (layer.mask_layer_id === layer.id) problems.push(`${layer.id}: a layer cannot mask itself`);
  }

  for (const spring of model_definition.physics) {
    for (const parameter_id of [spring.input_parameter_id, spring.output_parameter_id]) {
      if (!parameter_ids.has(parameter_id)) {
        problems.push(`physics.${spring.id}: unknown parameter "${parameter_id}"`);
      }
    }
  }

  const anchor_group_id = model_definition.hands?.face_anchor.group_id;
  if (anchor_group_id !== undefined && !group_ids.has(anchor_group_id)) {
    problems.push(`hands.face_anchor.group_id "${anchor_group_id}" is not a group`);
  }
  const arms_group_id = model_definition.hands?.arms?.group_id;
  if (arms_group_id !== undefined && !group_ids.has(arms_group_id)) {
    problems.push(`hands.arms.group_id "${arms_group_id}" is not a group`);
  }
  const arm_art = model_definition.hands?.arms?.art;
  if (arm_art) {
    const hand_pose_ids = arm_art.hand_poses.map((hand_pose) => hand_pose.id);
    if (new Set(hand_pose_ids).size !== hand_pose_ids.length) problems.push("hands.arms.art.hand_poses: duplicate id");
    if (!hand_pose_ids.includes(arm_art.rest_hand_pose_id)) {
      problems.push(`hands.arms.art.rest_hand_pose_id "${arm_art.rest_hand_pose_id}" is not a hand pose`);
    }
  }

  for (const expression of model_definition.expressions) {
    for (const parameter_id of Object.keys(expression.parameter_values)) {
      if (!parameter_ids.has(parameter_id)) {
        problems.push(`expressions.${expression.id}: unknown parameter "${parameter_id}"`);
      }
    }
  }

  return problems;
}

function check_binding(
  node_id: string,
  binding: ParameterBinding,
  parameter_ids: ReadonlySet<string>,
  vertex_count: number | undefined,
): string[] {
  const problems: string[] = [];
  const location = `${node_id}.bindings.${binding.parameter_id}`;
  if (!parameter_ids.has(binding.parameter_id)) problems.push(`${location}: unknown parameter`);

  binding.keyframes.forEach((keyframe, keyframe_index) => {
    const previous_keyframe = binding.keyframes[keyframe_index - 1];
    if (previous_keyframe && previous_keyframe.parameter_value >= keyframe.parameter_value) {
      problems.push(`${location}: keyframes must be sorted by parameter_value without repeats`);
    }
    if (keyframe.vertex_offsets === undefined) return;
    if (vertex_count === undefined) {
      problems.push(`${location}: vertex_offsets are only allowed on layers`);
    } else if (keyframe.vertex_offsets.length !== vertex_count * 2) {
      problems.push(`${location}: vertex_offsets needs ${vertex_count * 2} numbers`);
    }
  });
  return problems;
}

function find_parent_cycles(model_definition: ModelDefinition): string[] {
  const parent_by_id = new Map(model_definition.groups.map((group) => [group.id, group.parent_id]));
  const problems: string[] = [];
  for (const group of model_definition.groups) {
    const visited_ids = new Set<string>();
    let current_id: string | undefined = group.id;
    while (current_id !== undefined) {
      if (visited_ids.has(current_id)) {
        problems.push(`${group.id}: parent chain forms a cycle`);
        break;
      }
      visited_ids.add(current_id);
      current_id = parent_by_id.get(current_id);
    }
  }
  return problems;
}
