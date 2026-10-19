import { z } from "zod";

export const MODEL_FORMAT_NAME = "vtubearea-model";
export const MODEL_FORMAT_VERSION = 1;
export const MODEL_DEFINITION_FILE_NAME = "model.json";

const identifier_schema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "letters, digits and underscores, starting with a letter");
const point_schema = z.tuple([z.number(), z.number()]);

/** A keyframe says what a node looks like when its parameter has exactly this value. */
export const binding_keyframe_schema = z.object({
  parameter_value: z.number(),
  translate: point_schema.optional(),
  rotation_degrees: z.number().optional(),
  scale: point_schema.optional(),
  opacity: z.number().min(0).max(1).optional(),
  /** Per-vertex [dx, dy] pairs for the layer mesh grid, row by row. Layers only. */
  vertex_offsets: z.array(z.number()).optional(),
});

export const parameter_binding_schema = z.object({
  parameter_id: identifier_schema,
  keyframes: z.array(binding_keyframe_schema).min(2),
});

export const model_parameter_schema = z.object({
  id: identifier_schema,
  display_name: z.string().optional(),
  minimum: z.number(),
  maximum: z.number(),
  default_value: z.number(),
});

/** An invisible transform node. Layers and other groups hang under it. */
export const model_group_schema = z.object({
  id: identifier_schema,
  parent_id: identifier_schema.optional(),
  pivot: point_schema,
  bindings: z.array(parameter_binding_schema).default([]),
});

export const model_layer_schema = z.object({
  id: identifier_schema,
  parent_id: identifier_schema.optional(),
  /** Image path relative to the model folder: PNG, WebP or SVG. */
  texture: z.string().min(1),
  /** Where the texture sits on the model canvas, in canvas pixels. */
  rect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  /** Defaults to the rect center. */
  pivot: point_schema.optional(),
  draw_order: z.number().int(),
  /** Only the parts of this layer inside the mask layer are drawn. */
  mask_layer_id: identifier_schema.optional(),
  mesh: z
    .object({ columns: z.number().int().min(1).max(32), rows: z.number().int().min(1).max(32) })
    .default({ columns: 1, rows: 1 }),
  bindings: z.array(parameter_binding_schema).default([]),
});

/** A damped spring that turns motion of one parameter into sway on another (hair, earrings). */
export const physics_spring_schema = z.object({
  id: identifier_schema,
  input_parameter_id: identifier_schema,
  output_parameter_id: identifier_schema,
  stiffness: z.number().positive(),
  damping: z.number().min(0),
  output_scale: z.number().default(1),
});

export const model_expression_schema = z.object({
  id: identifier_schema,
  display_name: z.string(),
  parameter_values: z.record(identifier_schema, z.number()),
  fade_seconds: z.number().min(0).default(0.25),
});

const color_schema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "color like #ffcc99");

/**
 * Hands drawn from live hand tracking (all 21 points, so every finger follows).
 * Hands are placed relative to the face: a hand touching the user's cheek touches the
 * model's cheek, wherever the user sits in the camera picture.
 */
export const model_hands_schema = z.object({
  skin_color: color_schema,
  outline_color: color_schema,
  outline_width: z.number().min(0).default(4),
  /** Finger thickness relative to palm length (wrist to middle finger base). */
  finger_width_ratio: z.number().positive().default(0.26),
  /** Size of the drawn hand around the palm center; below 1 suits big-headed cartoon styles. */
  hand_scale: z.number().positive().default(1),
  face_anchor: z.object({
    /** Middle of the model's face (around the nose bridge), canvas pixels. */
    center: point_schema,
    /** Chin to forehead, canvas pixels. */
    height: z.number().positive(),
    /** Group the face moves with (head turns, tilts); the anchor follows it. */
    group_id: identifier_schema.optional(),
  }),
  /**
   * A hand farther from the camera than the face is drawn just below the first layer with
   * this draw_order (usually the face), so the head covers it. Omit to always draw hands on top.
   */
  behind_head_draw_order: z.number().int().optional(),
  /**
   * Whole arms: shoulder to tracked wrist, the elbow found by inverse kinematics.
   * "left" is the model's own left (the viewer's right).
   */
  arms: z
    .object({
      left_shoulder: point_schema,
      right_shoulder: point_schema,
      upper_arm_length: z.number().positive(),
      forearm_length: z.number().positive(),
      /** Sleeve thickness, canvas pixels. */
      width: z.number().positive(),
      color: color_schema,
      outline_color: color_schema,
      /** Group the shoulders move with (usually the body). */
      group_id: identifier_schema.optional(),
    })
    .optional(),
});

export const model_definition_schema = z.object({
  format: z.literal(MODEL_FORMAT_NAME),
  format_version: z.literal(MODEL_FORMAT_VERSION),
  metadata: z.object({
    name: z.string().min(1),
    author: z.string().optional(),
    license: z.string().optional(),
    description: z.string().optional(),
  }),
  canvas: z.object({ width: z.number().positive(), height: z.number().positive() }),
  parameters: z.array(model_parameter_schema),
  groups: z.array(model_group_schema).default([]),
  layers: z.array(model_layer_schema).min(1),
  physics: z.array(physics_spring_schema).default([]),
  expressions: z.array(model_expression_schema).default([]),
  hands: model_hands_schema.optional(),
});

export type ModelDefinition = z.infer<typeof model_definition_schema>;
export type ModelParameter = z.infer<typeof model_parameter_schema>;
export type ModelGroup = z.infer<typeof model_group_schema>;
export type ModelLayer = z.infer<typeof model_layer_schema>;
export type ParameterBinding = z.infer<typeof parameter_binding_schema>;
export type BindingKeyframe = z.infer<typeof binding_keyframe_schema>;
export type PhysicsSpring = z.infer<typeof physics_spring_schema>;
export type ModelExpression = z.infer<typeof model_expression_schema>;
export type ModelHands = z.infer<typeof model_hands_schema>;
