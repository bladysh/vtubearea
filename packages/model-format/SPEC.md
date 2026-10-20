# vTubeArea model format, version 1

A model is a **folder** with a `model.json` file and image files next to it.
Validate with `model.schema.json` (generated: `pnpm --filter @vtubearea/model-format generate:schema`)
or in code with `parse_model_definition()`.

```
my-model/
├── model.json
└── textures/
    ├── face.png
    └── ...
```

## Coordinates

Everything is in **canvas pixels**: `canvas.width × canvas.height`, origin top left,
y goes down. The app scales the canvas to the window.

## model.json

| Field | Meaning |
| --- | --- |
| `format` | Always `"vtubearea-model"` |
| `format_version` | `1`. A breaking change means a new major version plus a migration. |
| `metadata` | `name` (required), `author`, `license`, `description` |
| `canvas` | `{ width, height }` |
| `parameters` | Named numbers that drive the model: `id`, `display_name`, `minimum`, `maximum`, `default_value` |
| `groups` | Invisible transform nodes (`id`, `parent_id`, `pivot`, `bindings`) |
| `layers` | Drawn images (see below) |
| `physics` | Springs that turn motion of one parameter into sway on another |
| `expressions` | Named sets of parameter values with a fade time |

A parameter may have `snap: { values, hysteresis }` when its art is drawn in steps (for example
squinting lids): the value jumps to the nearest step but only leaves the current one once it is
`hysteresis` past the halfway point, so tracking noise does not flicker between two drawings.

Ids: letters, digits and `_`, starting with a letter. Parameter ids should follow
Live2D names (`ParamAngleX`, `ParamEyeLOpen`, ...) so default tracking works.

### Layers

| Field | Meaning |
| --- | --- |
| `texture` | Image path relative to the model folder: PNG, WebP or SVG. `..` and absolute paths are rejected. |
| `rect` | `{ x, y, width, height }`: where the image sits on the canvas |
| `pivot` | Rotation and scale center, defaults to the rect center |
| `draw_order` | Lower draws first (further back). Independent of the group tree. |
| `parent_id` | A group whose transform this layer follows |
| `mask_layer_id` | Only the parts inside that layer are drawn (iris inside eye white) |
| `mesh` | `{ columns, rows }` grid, 1×1 default. Needed for `vertex_offsets`. |
| `bindings` | How parameters change the layer |

### Bindings and keyframes

A binding ties one parameter to keyframes. Each keyframe says how the node
looks when the parameter has exactly `parameter_value`; values in between are
interpolated linearly and values outside the keyframes clamp.

```json
{
  "parameter_id": "ParamEyeLOpen",
  "keyframes": [
    { "parameter_value": 0, "scale": [1, 0.15], "opacity": 0 },
    { "parameter_value": 1, "scale": [1, 1] }
  ]
}
```

Keyframe fields, all optional: `translate [dx, dy]`, `rotation_degrees`,
`scale [sx, sy]`, `opacity 0..1`, `vertex_offsets` (layers only:
`(columns + 1) × (rows + 1)` pairs of `[dx, dy]`, row by row).

Several bindings on one node stack: translation and rotation add, scale and
opacity multiply, vertex offsets add. Group transforms apply to all children.
Keyframes must be sorted by `parameter_value` with no repeats.

### Physics

```json
{ "id": "front_hair_sway", "input_parameter_id": "ParamAngleX",
  "output_parameter_id": "ParamHairFront", "stiffness": 70, "damping": 9, "output_scale": 0.08 }
```

A damped spring chases the input value. The output parameter receives how far the
spring lags behind, times `output_scale`. Bind the output to a rotation to get sway.

### Expressions

```json
{ "id": "happy", "display_name": "Happy", "parameter_values": { "ParamMouthForm": 1 }, "fade_seconds": 0.25 }
```

Expressions blend over tracking. Pinned parameters (debug panel, control API) win over both.

### Hands (optional)

```json
"hands": {
  "skin_color": "#ffe6d8", "outline_color": "#d9a08e", "outline_width": 4,
  "finger_width_ratio": 0.26, "hand_scale": 0.65,
  "face_anchor": { "center": [512, 500], "height": 400, "group_id": "head" },
  "behind_head_draw_order": 20
}
```

When present and hand tracking is on, the app draws cartoon hands from the 21
tracked points, so every finger follows the user. Hands are placed relative to the
face: the offset of the user's hand from their face (measured in face heights) is
applied to `face_anchor.center` scaled by `face_anchor.height`, so a hand touching
the cheek touches the model's cheek. With `group_id` the anchor moves with that
group (usually the head) when the model turns or tilts. `hand_scale` shrinks or grows the hand around the palm center
(cartoon models with big heads look better below 1). Optional `face_anchor.width` (cheek to cheek) sets how far sideways a hand sits; it defaults to 0.75 of the height, like a real face, and is worth setting for wide cartoon heads. Hands are drawn above all layers,
except when the tracked hand is farther from the camera than the face (reaching behind
the head): then it is drawn just below the first layer whose `draw_order` is at least
`behind_head_draw_order` (for example the face), so the head covers part of it.

Optional `arms` draws whole arms: from a fixed shoulder (`left_shoulder` is the model's
own left, the viewer's right) to the tracked wrist. Hand tracking sees no elbow, so the
elbow is found with two-bone inverse kinematics from `upper_arm_length` and
`forearm_length`, bending outward like a real arm; out of reach, the arm stretches.
`group_id` makes the shoulders follow the body.

```json
"arms": { "left_shoulder": [672, 800], "right_shoulder": [352, 800], "upper_arm_length": 230,
          "forearm_length": 210, "width": 64, "color": "#2a2d31", "outline_color": "#383e46", "group_id": "body_group" }
```

#### Painted arms (`arms.art`)

Painted models bring their own arm art instead of drawn sleeves. Paint the model's RIGHT
arm (viewer's left) in its rest pose; the left arm is the same art mirrored around the
middle between the two shoulders. Arms with art are always on screen: without a tracked
hand they hang as painted, and they ease up to the tracked hand and back down.

```json
"art": {
  "upper_arm": { "texture": "textures/upper_arm.png", "rect": { "x": 250, "y": 300, "width": 90, "height": 220 },
                 "start": [300, 310], "end": [280, 500] },
  "forearm":   { "texture": "textures/forearm.png", "rect": { ... }, "start": [280, 500], "end": [255, 700] },
  "hand_poses": [
    { "id": "rest", "texture": "textures/hand_rest.png", "rect": { ... },
      "wrist": [255, 700], "index_base": [250, 760], "pinky_base": [270, 755] },
    { "id": "peace", "texture": "textures/hand_peace.png", "rect": { ... },
      "wrist": [255, 700], "index_base": [245, 640], "pinky_base": [268, 642],
      "extended_fingers": [false, true, true, false, false] }
  ],
  "rest_hand_pose_id": "rest"
}
```

- `upper_arm` turns around `start` (shoulder) so `end` lands on the solved elbow; `forearm`
  runs from the elbow to the wrist. Bones stretch only along their length, never in width.
  With art the arm never over-stretches: an out-of-reach hand is pulled back toward the shoulder.
  `upper_arm_length` and `forearm_length` should match the art (`start` to `end`).
- Each hand pose is pinned at its `wrist` and turned so `index_base` and `pinky_base` line up
  with the tracked knuckles; it keeps its painted size and flips when the user shows the
  other side of the hand. The pose whose `extended_fingers` (thumb, index, middle, ring,
  pinky) best matches the tracked fingers is shown. The forearm is drawn over the hand, so
  the sleeve cuff covers the wrist.
- If no hand pose has `extended_fingers` (or the user picks drawn hands in the app), the tracked hand is drawn from its 21 points instead
  (`skin_color`, `outline_color`, `outline_width`, `finger_width_ratio`, `hand_scale`), so every
  finger follows; the painted rest pose is still shown while the arm hangs.
- `width`, `color` and `outline_color` are ignored when `art` is present.

Models with their own hand art can instead bind layers to the tracking inputs
`HandLeftFound`, `HandLeftPositionX/Y`, `HandLeftOpen` (and `Right`).

## Planned (not in v1)

- Texture atlases (`texture_region` per layer).
- PSD import that writes this format.
- Optional Live2D support only as a separate plugin, if the owner decides so.
