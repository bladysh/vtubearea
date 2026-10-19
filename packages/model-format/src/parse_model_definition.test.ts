import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse_model_definition } from "./parse_model_definition";

const SAMPLE_MODEL_IDS = ["lumi", "kuro"];

function read_sample_model(model_id: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../assets/sample-models/${model_id}/model.json`, import.meta.url), "utf8"));
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
