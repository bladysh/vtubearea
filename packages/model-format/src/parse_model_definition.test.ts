import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse_model_definition } from "./parse_model_definition";

const SAMPLE_MODELS_DIRECTORY = new URL("../../../assets/sample-models/", import.meta.url);
// Every sample model on disk, so models kept only locally (not in git) are checked too.
const SAMPLE_MODEL_IDS = readdirSync(SAMPLE_MODELS_DIRECTORY, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

function read_sample_model(model_id: string): unknown {
  return JSON.parse(readFileSync(new URL(`${model_id}/model.json`, SAMPLE_MODELS_DIRECTORY), "utf8"));
}

function minimal_model(overrides: Record<string, unknown> = {}) {
  return {
    format: "vtubearea-model",
    format_version: 1,
    metadata: { name: "Test" },
    canvas: { width: 100, height: 100 },
    parameters: [{ id: "ParamAngleX", minimum: -30, maximum: 30, default_value: 0 }],
    layers: [
      {
        id: "face",
        texture: "face.png",
        rect: { x: 0, y: 0, width: 100, height: 100 },
        draw_order: 0,
        bindings: [
          {
            parameter_id: "ParamAngleX",
            keyframes: [
              { parameter_value: -30, translate: [-5, 0] },
              { parameter_value: 30, translate: [5, 0] },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("parse_model_definition", () => {
  it.each(SAMPLE_MODEL_IDS)("accepts the bundled sample model %s", (model_id) => {
    const parse_result = parse_model_definition(read_sample_model(model_id));
    expect(parse_result.success ? [] : parse_result.problems).toEqual([]);
  });

  it("accepts a minimal model and fills defaults", () => {
    const parse_result = parse_model_definition(minimal_model());
    expect(parse_result.success).toBe(true);
    if (parse_result.success) expect(parse_result.model_definition.layers[0]?.mesh).toEqual({ columns: 1, rows: 1 });
  });

  it("rejects unknown parameter references", () => {
    const model = minimal_model({ parameters: [] });
    const parse_result = parse_model_definition(model);
    expect(parse_result.success).toBe(false);
    if (!parse_result.success) expect(parse_result.problems.join()).toContain("unknown parameter");
  });

  it("rejects unsorted keyframes and wrong vertex offset length", () => {
    const model = minimal_model();
    const binding = model.layers[0]!.bindings[0]!;
    binding.keyframes = [
      { parameter_value: 30, translate: [5, 0] },
      { parameter_value: -30, vertex_offsets: [1, 2] } as never,
    ];
    const parse_result = parse_model_definition(model);
    expect(parse_result.success).toBe(false);
    if (!parse_result.success) {
      expect(parse_result.problems.join()).toContain("sorted");
      expect(parse_result.problems.join()).toContain("needs 8 numbers");
    }
  });

  it("rejects painted arms whose rest pose is missing", () => {
    const part = { texture: "arm.png", rect: { x: 0, y: 0, width: 10, height: 10 } };
    const hand_pose = { ...part, id: "open", wrist: [0, 0], index_base: [1, 0], pinky_base: [0, 1] };
    const model = minimal_model({
      hands: {
        skin_color: "#ffffff",
        outline_color: "#000000",
        face_anchor: { center: [50, 50], height: 40 },
        arms: {
          left_shoulder: [70, 60], right_shoulder: [30, 60], upper_arm_length: 20, forearm_length: 20,
          width: 5, color: "#000000", outline_color: "#000000",
          art: {
            upper_arm: { ...part, start: [0, 0], end: [0, 5] },
            forearm: { ...part, start: [0, 5], end: [0, 9] },
            hand_poses: [hand_pose, hand_pose],
            rest_hand_pose_id: "relaxed",
          },
        },
      },
    });
    const parse_result = parse_model_definition(model);
    expect(parse_result.success ? [] : parse_result.problems).toEqual([
      "hands.arms.art.hand_poses: duplicate id",
      'hands.arms.art.rest_hand_pose_id "relaxed" is not a hand pose',
    ]);
  });

  it("rejects parent cycles", () => {
    const model = minimal_model({
      groups: [
        { id: "first", parent_id: "second", pivot: [0, 0] },
        { id: "second", parent_id: "first", pivot: [0, 0] },
      ],
    });
    const parse_result = parse_model_definition(model);
    expect(parse_result.success).toBe(false);
    if (!parse_result.success) expect(parse_result.problems.join()).toContain("cycle");
  });
});
