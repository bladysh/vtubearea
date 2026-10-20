import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse_model_definition, type ModelDefinition } from "@vtubearea/model-format";
import { create_default_parameter_mappings } from "../domain/default_parameter_mappings";
import { map_input_value } from "../domain/parameter_mapping";
import { AvatarFrameComposer } from "./avatar_frame_composer";

function load_sample_model(): ModelDefinition {
  const model_json: unknown = JSON.parse(
    readFileSync(new URL("../../../../../../assets/sample-models/lumi/model.json", import.meta.url), "utf8"),
  );
  const parse_result = parse_model_definition(model_json);
  if (!parse_result.success) throw new Error(parse_result.problems.join("\n"));
  return parse_result.model_definition;
}

function create_composer() {
  const model_definition = load_sample_model();
  const frame_composer = new AvatarFrameComposer({
    auto_blink_min_interval_ms: 100_000,
    auto_blink_max_interval_ms: 100_000,
    breathing_period_ms: 3000,
  });
  frame_composer.load_model(model_definition, create_default_parameter_mappings(model_definition.parameters));
  return frame_composer;
}

function run_frames(frame_composer: AvatarFrameComposer, frame_count: number, is_face_found: boolean, input_values: Record<string, number>) {
  let parameter_values: Readonly<Record<string, number>> = {};
  for (let frame_index = 0; frame_index < frame_count; frame_index += 1) {
    parameter_values = frame_composer.compose({ is_face_found, input_values }, 1 / 60);
  }
  return parameter_values;
}

describe("map_input_value", () => {
  const mapping = {
    id: "test",
    input_name: "MouthOpen",
    output_parameter_id: "ParamMouthOpenY",
    input_minimum: 0,
    input_maximum: 0.5,
    output_minimum: 0,
    output_maximum: 1,
    clamp_output: true,
    smoothing: 0,
    is_enabled: true,
  };

  it("stretches the input range onto the output range", () => {
    expect(map_input_value(mapping, 0.25)).toBeCloseTo(0.5);
  });

  it("clamps when asked", () => {
    expect(map_input_value(mapping, 2)).toBe(1);
    expect(map_input_value({ ...mapping, clamp_output: false }, 1)).toBeCloseTo(2);
  });
});

describe("AvatarFrameComposer", () => {
  it("follows tracking once the face is found", () => {
    const parameter_values = run_frames(create_composer(), 120, true, { FaceAngleX: 15, MouthOpen: 0.7 });
    expect(parameter_values.ParamAngleX).toBeCloseTo(15, 1);
    expect(parameter_values.ParamMouthOpenY).toBeCloseTo(1, 1);
  });

  it("eases back to the neutral pose when the face is lost", () => {
    const frame_composer = create_composer();
    run_frames(frame_composer, 120, true, { FaceAngleX: 20 });
    const parameter_values = run_frames(frame_composer, 60, false, {});
    expect(parameter_values.ParamAngleX).toBeCloseTo(0, 1);
  });

  it("lets overrides win and expire", () => {
    const frame_composer = create_composer();
    frame_composer.set_parameter_overrides({ ParamCheek: 1, UnknownParam: 5 }, 0.5);
    expect(run_frames(frame_composer, 10, false, {}).ParamCheek).toBe(1);
    expect(frame_composer.get_parameter_overrides()).toEqual({ ParamCheek: 1 });
    expect(run_frames(frame_composer, 40, false, {}).ParamCheek).toBe(0);
  });

  it("fades expressions in", () => {
    const frame_composer = create_composer();
    frame_composer.set_expression("happy");
    expect(frame_composer.get_active_expression_id()).toBe("happy");
    expect(run_frames(frame_composer, 60, false, {}).ParamMouthForm).toBeCloseTo(1);
  });

  it("swings hair after a fast head turn", () => {
    const frame_composer = create_composer();
    run_frames(frame_composer, 60, true, { FaceAngleX: 0 });
    const parameter_values = run_frames(frame_composer, 3, true, { FaceAngleX: 30 });
    expect(Math.abs(parameter_values.ParamHairFront ?? 0)).toBeGreaterThan(0.01);
  });

  it("places tracked hands on the canvas and fades them out when lost", () => {
    const frame_composer = create_composer();
    const hand_points = Array.from({ length: 21 }, () => [0, 0] as [number, number]);
    const keep_point = (_group_id: string | undefined, point: [number, number]) => point;
    const user_face = { center: [0, 0] as [number, number], height: 0.4 };
    let rendered_hands = frame_composer.compose_hands([{ points: hand_points, is_present: true, is_behind_head: false }, null], user_face, keep_point, 1);
    expect(rendered_hands[0]?.opacity).toBe(1);
    expect(rendered_hands[0]?.points[0]).toEqual(load_sample_model().hands?.face_anchor.center);
    expect(rendered_hands[1]?.opacity).toBe(0);

    rendered_hands = frame_composer.compose_hands([{ points: hand_points, is_present: false, is_behind_head: false }, null], user_face, keep_point, 1);
    expect(rendered_hands[0]?.opacity).toBe(0);
  });

  it("keeps painted arms resting as painted, mirrored for the left arm, when no hand is tracked", () => {
    const sample_model = load_sample_model();
    const part = { texture: "arm.png", rect: { x: 0, y: 0, width: 10, height: 10 } };
    const arms = {
      ...sample_model.hands!.arms!,
      left_shoulder: [600, 300] as [number, number],
      right_shoulder: [400, 300] as [number, number],
      art: {
        upper_arm: { ...part, start: [400, 300] as [number, number], end: [380, 400] as [number, number] },
        forearm: { ...part, start: [380, 400] as [number, number], end: [370, 500] as [number, number] },
        hand_poses: [{ ...part, id: "rest", wrist: [370, 500] as [number, number], index_base: [365, 540] as [number, number], pinky_base: [380, 540] as [number, number] }],
        rest_hand_pose_id: "rest",
        max_stretch: 1,
      },
    };
    const frame_composer = new AvatarFrameComposer({ auto_blink_min_interval_ms: 1, auto_blink_max_interval_ms: 1, breathing_period_ms: 1 });
    frame_composer.load_model({ ...sample_model, hands: { ...sample_model.hands!, arms } }, []);
    const keep_point = (_group_id: string | undefined, point: [number, number]) => point;
    const rendered_hands = frame_composer.compose_hands([null, null], null, keep_point, 1 / 60);
    const left_arm = rendered_hands.find((rendered_hand) => rendered_hand.painted_hand?.is_mirrored)!;
    expect(left_arm.opacity).toBe(1);
    expect(left_arm.painted_hand).toMatchObject({ hand: { kind: "sprite", pose_id: "rest" }, wrist: [630, 500] });
    expect(left_arm.arm?.elbow[0]).toBeCloseTo(620, 0);
  });

  it("describes the model for external controllers", () => {
    const model_description = create_composer().describe_model();
    expect(model_description?.name).toBe("Lumi");
    expect(model_description?.expressions.map((expression) => expression.id)).toContain("surprised");
  });
});
