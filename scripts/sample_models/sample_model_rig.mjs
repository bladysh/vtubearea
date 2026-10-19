// Shared rig for the sample models: parameters, groups, layers, physics, expressions.

export const keyframe = (parameter_value, pose = {}) => ({ parameter_value, ...pose });
export const binding = (parameter_id, ...keyframes) => ({ parameter_id, keyframes });

function parameter(id, display_name, minimum, maximum, default_value = 0) {
  return { id, display_name, minimum, maximum, default_value };
}

function layer(id, rect, draw_order, parent_id, { bindings = [], mask_layer_id, pivot, texture = id } = {}) {
  const [x, y, width, height] = rect;
  return {
    id,
    texture: `textures/${texture}.svg`,
    rect: { x, y, width, height },
    draw_order,
    ...(parent_id && { parent_id }),
    ...(pivot && { pivot }),
    ...(mask_layer_id && { mask_layer_id }),
    ...(bindings.length > 0 && { bindings }),
  };
}

export function build_parameters() {
  const parameters = [
    parameter("ParamAngleX", "Head turn", -30, 30),
    parameter("ParamAngleY", "Head nod", -30, 30),
    parameter("ParamAngleZ", "Head tilt", -30, 30),
    parameter("ParamEyeLOpen", "Left eye open", 0, 1, 1),
    parameter("ParamEyeROpen", "Right eye open", 0, 1, 1),
    parameter("ParamEyeBallX", "Gaze horizontal", -1, 1),
    parameter("ParamEyeBallY", "Gaze vertical", -1, 1),
    parameter("ParamBrowLY", "Left brow height", -1, 1),
    parameter("ParamBrowRY", "Right brow height", -1, 1),
    parameter("ParamMouthOpenY", "Mouth open", 0, 1),
    parameter("ParamMouthForm", "Mouth smile", -1, 1),
    parameter("ParamCheek", "Blush", 0, 1),
    parameter("ParamBodyAngleX", "Body turn", -10, 10),
    parameter("ParamBodyAngleZ", "Body tilt", -10, 10),
    parameter("ParamBreath", "Breathing", 0, 1),
    parameter("ParamHairFront", "Front hair sway", -1, 1),
    parameter("ParamHairBack", "Back hair sway", -1, 1),
  ];
  return parameters;
}

function eye_group(side, center_x, open_parameter_id) {
  return {
    id: `eye_${side}`,
    parent_id: "face_features",
    pivot: [center_x, 500],
    bindings: [
      binding(open_parameter_id, keyframe(0, { scale: [1, 0.15], opacity: 0 }), keyframe(0.3, { scale: [1, 0.55], opacity: 1 }), keyframe(1, { scale: [1, 1] })),
    ],
  };
}

function build_groups() {
  const groups = [
    {
      id: "body_group",
      pivot: [512, 1000],
      bindings: [
        binding("ParamBodyAngleX", keyframe(-10, { translate: [-14, 0] }), keyframe(10, { translate: [14, 0] })),
        binding("ParamBodyAngleZ", keyframe(-10, { rotation_degrees: -4 }), keyframe(10, { rotation_degrees: 4 })),
        binding("ParamBreath", keyframe(0, { scale: [1, 1] }), keyframe(1, { scale: [1.01, 1.02] })),
      ],
    },
    {
      id: "head",
      parent_id: "body_group",
      pivot: [512, 690],
      bindings: [
        binding("ParamAngleX", keyframe(-30, { translate: [-18, 0] }), keyframe(30, { translate: [18, 0] })),
        binding("ParamAngleY", keyframe(-30, { translate: [0, 10] }), keyframe(30, { translate: [0, -10] })),
        binding("ParamAngleZ", keyframe(-30, { rotation_degrees: -15 }), keyframe(30, { rotation_degrees: 15 })),
      ],
    },
    {
      id: "face_features",
      parent_id: "head",
      pivot: [512, 500],
      bindings: [
        binding("ParamAngleX", keyframe(-30, { translate: [-30, 0], scale: [0.97, 1] }), keyframe(0, { scale: [1, 1] }), keyframe(30, { translate: [30, 0], scale: [0.97, 1] })),
        binding("ParamAngleY", keyframe(-30, { translate: [0, 18] }), keyframe(30, { translate: [0, -18] })),
      ],
    },
    {
      id: "hair_front_group",
      parent_id: "head",
      pivot: [512, 200],
      bindings: [
        binding("ParamAngleX", keyframe(-30, { translate: [-40, 0] }), keyframe(30, { translate: [40, 0] })),
        binding("ParamAngleY", keyframe(-30, { translate: [0, 14] }), keyframe(30, { translate: [0, -14] })),
        binding("ParamHairFront", keyframe(-1, { rotation_degrees: -7 }), keyframe(1, { rotation_degrees: 7 })),
      ],
    },
    eye_group("left", 440, "ParamEyeLOpen"),
    eye_group("right", 584, "ParamEyeROpen"),
  ];
  return groups;
}

function build_layers(features) {
  const iris_bindings = [
    binding("ParamEyeBallX", keyframe(-1, { translate: [-14, 0] }), keyframe(1, { translate: [14, 0] })),
    binding("ParamEyeBallY", keyframe(-1, { translate: [0, 10] }), keyframe(1, { translate: [0, -10] })),
  ];
  const layers = [
    layer("hair_back", [262, 170, 500, 640], 0, "head", {
      pivot: [512, 220],
      bindings: [
        binding("ParamAngleX", keyframe(-30, { translate: [14, 0] }), keyframe(30, { translate: [-14, 0] })),
        binding("ParamHairBack", keyframe(-1, { rotation_degrees: -4 }), keyframe(1, { rotation_degrees: 4 })),
      ],
    }),
    layer("body", [232, 620, 560, 404], 10, "body_group"),
    layer("face", [332, 270, 360, 420], 20, "head"),
    layer("blush", [386, 552, 252, 40], 25, "face_features", { bindings: [binding("ParamCheek", keyframe(0, { opacity: 0 }), keyframe(1, { opacity: 1 }))] }),
    layer("nose", [504, 548, 16, 12], 26, "face_features"),
    layer("mouth_open", [482, 588, 60, 44], 30, "face_features", {
      pivot: [512, 590],
      bindings: [
        binding("ParamMouthOpenY", keyframe(0, { scale: [1, 0.05], opacity: 0 }), keyframe(0.1, { scale: [1, 0.2], opacity: 1 }), keyframe(1, { scale: [1, 1] })),
      ],
    }),
    layer("mouth_frown", [472, 580, 80, 28], 31, "face_features", { bindings: [binding("ParamMouthForm", keyframe(-1, { opacity: 1 }), keyframe(0, { opacity: 0 }))] }),
    layer("mouth_neutral", [472, 580, 80, 28], 32, "face_features", {
      bindings: [binding("ParamMouthForm", keyframe(-1, { opacity: 0 }), keyframe(0, { opacity: 1 }), keyframe(1, { opacity: 0 }))],
    }),
    layer("mouth_smile", [472, 580, 80, 28], 33, "face_features", { bindings: [binding("ParamMouthForm", keyframe(0, { opacity: 0 }), keyframe(1, { opacity: 1 }))] }),
  ];

  for (const [side, x_shift, open_parameter_id, brow_parameter_id] of [
    ["left", 0, "ParamEyeLOpen", "ParamBrowLY"],
    ["right", 144, "ParamEyeROpen", "ParamBrowRY"],
  ]) {
    layers.push(
      layer(`eye_white_${side}`, [398 + x_shift, 468, 84, 64], 40, `eye_${side}`),
      layer(`iris_${side}`, [417 + x_shift, 472, 46, 56], 41, `eye_${side}`, { bindings: iris_bindings, mask_layer_id: `eye_white_${side}` }),
      layer(`lash_${side}`, [390 + x_shift, 456, 100, 32], 42, `eye_${side}`),
      layer(`eye_closed_${side}`, [400 + x_shift, 492, 80, 24], 43, "face_features", {
        bindings: [binding(open_parameter_id, keyframe(0, { opacity: 1 }), keyframe(0.3, { opacity: 0 }))],
      }),
      layer(`brow_${side}`, [396 + x_shift, 420, 88, 24], 50, "face_features", {
        bindings: [binding(brow_parameter_id, keyframe(-1, { translate: [0, 8] }), keyframe(1, { translate: [0, -12] }))],
      }),
    );
  }

  if (features.has_cat_ears) layers.push(layer("cat_ears", [300, 120, 424, 160], 55, "hair_front_group"));
  // Tall enough for side locks that reach the cheeks.
  layers.push(layer("hair_front", [300, 180, 424, 400], 60, "hair_front_group"));

  return layers;
}

export const SAMPLE_EXPRESSIONS = [
  { id: "happy", display_name: "Happy", parameter_values: { ParamMouthForm: 1, ParamCheek: 1, ParamBrowLY: 0.4, ParamBrowRY: 0.4 }, fade_seconds: 0.25 },
  { id: "surprised", display_name: "Surprised", parameter_values: { ParamBrowLY: 1, ParamBrowRY: 1, ParamMouthOpenY: 0.6, ParamMouthForm: 0 }, fade_seconds: 0.15 },
  { id: "sad", display_name: "Sad", parameter_values: { ParamMouthForm: -1, ParamBrowLY: -0.7, ParamBrowRY: -0.7 }, fade_seconds: 0.4 },
  { id: "wink", display_name: "Wink", parameter_values: { ParamEyeROpen: 0, ParamMouthForm: 1 }, fade_seconds: 0.1 },
];

export function build_sample_model_definition(metadata, features, palette) {
  return {
    $schema: "../../../packages/model-format/model.schema.json",
    format: "vtubearea-model",
    format_version: 1,
    metadata,
    canvas: { width: 1024, height: 1024 },
    parameters: build_parameters(),
    groups: build_groups(),
    layers: build_layers(features),
    physics: [
      { id: "front_hair_sway", input_parameter_id: "ParamAngleX", output_parameter_id: "ParamHairFront", stiffness: 70, damping: 9, output_scale: 0.08 },
      { id: "back_hair_sway", input_parameter_id: "ParamAngleX", output_parameter_id: "ParamHairBack", stiffness: 40, damping: 6, output_scale: 0.1 },
    ],
    expressions: SAMPLE_EXPRESSIONS,
    hands: {
      skin_color: palette.skin[0],
      outline_color: palette.hand_outline,
      outline_width: 4,
      finger_width_ratio: 0.26,
      hand_scale: 0.65,
      // Face from forehead (~285) to chin (~676); center near the nose bridge; moves with the head.
      face_anchor: { center: [512, 490], height: 390, group_id: "head" },
      // Behind the head = under the face (20) and everything on it, above back hair and body.
      behind_head_draw_order: 20,
      // Shoulders sit on the hoodie; the elbow is solved each frame from the tracked wrist.
      arms: {
        left_shoulder: [668, 806],
        right_shoulder: [356, 806],
        upper_arm_length: 230,
        forearm_length: 210,
        width: 62,
        color: palette.hoodie[0],
        outline_color: palette.collar,
        group_id: "body_group",
      },
    },
  };
}
