import { describe, expect, it } from "vitest";
import { parse_model_definition, type ModelDefinition } from "@vtubearea/model-format";
import { transform_point } from "./affine_matrix";
import { evaluate_node_pose } from "./binding_evaluation";
import { create_grid_geometry } from "./mesh_grid";
import { ModelPoseSolver } from "./model_pose_solver";

function build_model(): ModelDefinition {
  const parse_result = parse_model_definition({
    format: "vtubearea-model",
    format_version: 1,
    metadata: { name: "Test" },
    canvas: { width: 200, height: 200 },
    parameters: [
      { id: "ParamAngleZ", minimum: -30, maximum: 30, default_value: 0 },
      { id: "ParamEyeOpen", minimum: 0, maximum: 1, default_value: 1 },
    ],
    groups: [
      {
        id: "head",
        pivot: [100, 100],
        bindings: [
          {
            parameter_id: "ParamAngleZ",
            keyframes: [
              { parameter_value: -30, rotation_degrees: -90 },
              { parameter_value: 30, rotation_degrees: 90 },
            ],
          },
        ],
      },
    ],
    layers: [
      {
        id: "eye",
        parent_id: "head",
        texture: "eye.png",
        rect: { x: 140, y: 90, width: 20, height: 20 },
        draw_order: 1,
        bindings: [
          {
            parameter_id: "ParamEyeOpen",
            keyframes: [
              { parameter_value: 0, scale: [1, 0], opacity: 0.5 },
              { parameter_value: 1, scale: [1, 1], opacity: 1 },
            ],
          },
        ],
      },
    ],
  });
  if (!parse_result.success) throw new Error(parse_result.problems.join("\n"));
  return parse_result.model_definition;
}

describe("evaluate_node_pose", () => {
  const bindings = build_model().layers[0]!.bindings;

  it("interpolates between keyframes", () => {
    const node_pose = evaluate_node_pose(bindings, { ParamEyeOpen: 0.5 }, 0);
    expect(node_pose.scale_y).toBeCloseTo(0.5);
    expect(node_pose.opacity).toBeCloseTo(0.75);
  });

  it("clamps outside the keyframe range", () => {
    expect(evaluate_node_pose(bindings, { ParamEyeOpen: 5 }, 0).scale_y).toBe(1);
    expect(evaluate_node_pose(bindings, { ParamEyeOpen: -5 }, 0).scale_y).toBe(0);
  });
});

describe("ModelPoseSolver", () => {
  it("applies the parent group rotation around its pivot to child layers", () => {
    const pose_solver = new ModelPoseSolver(build_model());
    const solved_layers = pose_solver.solve({ ParamAngleZ: 30, ParamEyeOpen: 1 });
    const eye_pose = solved_layers.get("eye")!;
    // Eye center (150, 100) rotated 90 degrees around (100, 100) lands at (100, 150).
    const [moved_x, moved_y] = transform_point(eye_pose.world_matrix, 150, 100);
    expect(moved_x).toBeCloseTo(100);
    expect(moved_y).toBeCloseTo(150);
  });

  it("exposes group transforms from the latest solve", () => {
    const pose_solver = new ModelPoseSolver(build_model());
    pose_solver.solve({ ParamAngleZ: 30, ParamEyeOpen: 1 });
    const [moved_x, moved_y] = transform_point(pose_solver.group_world_matrix("head"), 150, 100);
    expect(moved_x).toBeCloseTo(100);
    expect(moved_y).toBeCloseTo(150);
  });

  it("uses parameter defaults as the rest pose", () => {
    const pose_solver = new ModelPoseSolver(build_model());
    expect(pose_solver.default_parameter_values()).toEqual({ ParamAngleZ: 0, ParamEyeOpen: 1 });
  });
});

describe("create_grid_geometry", () => {
  it("builds vertices, uvs and two triangles per cell", () => {
    const grid_geometry = create_grid_geometry({ x: 10, y: 20, width: 100, height: 50 }, 2, 1);
    expect(grid_geometry.rest_positions.length).toBe(12);
    expect(Array.from(grid_geometry.rest_positions.slice(-2))).toEqual([110, 70]);
    expect(grid_geometry.indices.length).toBe(12);
    expect(Math.max(...grid_geometry.indices)).toBe(5);
  });
});
