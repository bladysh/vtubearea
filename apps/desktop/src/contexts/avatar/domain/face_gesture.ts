/** Face gestures that can start an expression, like a hotkey does. Sides are as on the avatar. */
export const FACE_GESTURES = [
  "wink_left",
  "wink_right",
  "brows_raised",
  "brows_lowered",
  "mouth_wide_open",
  "big_smile",
  "sad_mouth",
  "head_tilt_left",
  "head_tilt_right",
] as const;
export type FaceGesture = (typeof FACE_GESTURES)[number];

/** toggle: the gesture switches the expression on and off, like a key; while_held: on only while the gesture lasts. */
export type GestureTriggerMode = "toggle" | "while_held";

export interface GestureTrigger {
  gesture: FaceGesture;
  mode: GestureTriggerMode;
}

export interface GestureEvents {
  /** Held long enough to count, this check. */
  started: FaceGesture[];
  /** Counted before and let go of now. */
  ended: FaceGesture[];
}

/** The user's own thresholds, where they differ from the defaults. */
export type GestureThresholds = Partial<Record<FaceGesture, number>>;

type InputValues = Readonly<Record<string, number>>;
type Input = (name: string, fallback: number) => number;

/**
 * How a gesture is measured: one number from the tracking hub's (calibrated) inputs, compared
 * with a threshold. "below" gestures count when it drops under it, "above" ones when it rises
 * past it. `range` bounds the threshold slider; `requires` adds a fixed condition.
 */
export interface GestureDefinition {
  measure: (input: Input) => number;
  direction: "above" | "below";
  default_threshold: number;
  range: readonly [number, number];
  /** How long it must be held before it counts; a blink must not read as a wink. */
  hold_seconds: number;
  requires?: (input: Input) => boolean;
}

export const GESTURE_DEFINITIONS: Readonly<Record<FaceGesture, GestureDefinition>> = {
  // A wink keeps the other eye open, so a blink of both eyes is not a wink.
  wink_left: {
    measure: (input) => input("EyeOpenLeft", 1),
    direction: "below",
    default_threshold: 0.25,
    range: [0.05, 0.6],
    hold_seconds: 0.35,
    requires: (input) => input("EyeOpenRight", 1) > 0.6,
  },
  wink_right: {
    measure: (input) => input("EyeOpenRight", 1),
    direction: "below",
    default_threshold: 0.25,
    range: [0.05, 0.6],
    hold_seconds: 0.35,
    requires: (input) => input("EyeOpenLeft", 1) > 0.6,
  },
  brows_raised: {
    measure: (input) => Math.min(input("BrowLeftY", 0), input("BrowRightY", 0)),
    direction: "above",
    default_threshold: 0.18,
    range: [0.04, 0.4],
    hold_seconds: 0.5,
  },
  brows_lowered: {
    measure: (input) => Math.max(input("BrowLeftY", 0), input("BrowRightY", 0)),
    direction: "below",
    default_threshold: -0.12,
    range: [-0.4, -0.02],
    hold_seconds: 0.6,
  },
  mouth_wide_open: { measure: (input) => input("MouthOpen", 0), direction: "above", default_threshold: 0.45, range: [0.15, 0.8], hold_seconds: 0.5 },
  big_smile: { measure: (input) => input("MouthSmile", 0), direction: "above", default_threshold: 0.4, range: [0.1, 0.8], hold_seconds: 0.6 },
  // Mouth corners go down much less than they go up, so this asks for far less than the smile.
  sad_mouth: { measure: (input) => input("MouthSmile", 0), direction: "below", default_threshold: -0.15, range: [-0.6, -0.03], hold_seconds: 0.6 },
  head_tilt_left: { measure: (input) => input("FaceAngleZ", 0), direction: "below", default_threshold: -20, range: [-40, -5], hold_seconds: 0.5 },
  head_tilt_right: { measure: (input) => input("FaceAngleZ", 0), direction: "above", default_threshold: 20, range: [5, 40], hold_seconds: 0.5 },
};

export function gesture_threshold(gesture: FaceGesture, thresholds: GestureThresholds): number {
  return thresholds[gesture] ?? GESTURE_DEFINITIONS[gesture].default_threshold;
}

/** The gesture's live number and whether the face shows it right now (before any hold time). */
export function read_gesture(gesture: FaceGesture, input_values: InputValues, thresholds: GestureThresholds): { value: number; is_shown: boolean } {
  const input: Input = (name, fallback) => input_values[name] ?? fallback;
  const definition = GESTURE_DEFINITIONS[gesture];
  const value = definition.measure(input);
  const threshold = gesture_threshold(gesture, thresholds);
  const passes = definition.direction === "above" ? value > threshold : value < threshold;
  return { value, is_shown: passes && (definition.requires?.(input) ?? true) };
}

/** The gesture's number on a relaxed face (every input at its rest value). */
function relaxed_value(definition: GestureDefinition): number {
  return definition.measure((_name, fallback) => fallback);
}

function far_end(definition: GestureDefinition): number {
  return definition.direction === "above" ? definition.range[1] : definition.range[0];
}

/** How strongly a gesture is shown, as a share: 0 is a relaxed face, 1 the far end of its threshold range. */
export function gesture_strength(gesture: FaceGesture, value: number): number {
  const definition = GESTURE_DEFINITIONS[gesture];
  const relaxed = relaxed_value(definition);
  return Math.min(1, Math.max(0, (value - relaxed) / (far_end(definition) - relaxed)));
}

export function threshold_for_strength(gesture: FaceGesture, strength: number): number {
  const definition = GESTURE_DEFINITIONS[gesture];
  const relaxed = relaxed_value(definition);
  return relaxed + strength * (far_end(definition) - relaxed);
}

/** The weakest strength the threshold slider allows (the near end of the threshold range). */
export function weakest_strength(gesture: FaceGesture): number {
  const definition = GESTURE_DEFINITIONS[gesture];
  return gesture_strength(gesture, definition.direction === "above" ? definition.range[0] : definition.range[1]);
}

/** A counted gesture must be gone this long before it ends, so one noisy frame does not drop it. */
const RELEASE_SECONDS = 0.2;

/**
 * Turns face tracking into gesture events. A gesture fires once when it has been held long
 * enough, and can fire again only after the face has let go of it, so holding a wink does not
 * toggle an expression on and off.
 */
export class FaceGestureDetector {
  private readonly held_seconds = new Map<FaceGesture, number>();
  private readonly fired = new Set<FaceGesture>();
  private readonly released_seconds = new Map<FaceGesture, number>();

  update(input_values: InputValues, is_face_found: boolean, delta_seconds: number, thresholds: GestureThresholds = {}): GestureEvents {
    const fired_now: FaceGesture[] = [];
    const ended_now: FaceGesture[] = [];
    for (const gesture of FACE_GESTURES) {
      if (!is_face_found || !read_gesture(gesture, input_values, thresholds).is_shown) {
        this.held_seconds.delete(gesture);
        if (!this.fired.has(gesture)) continue;
        const released_seconds = (this.released_seconds.get(gesture) ?? 0) + delta_seconds;
        this.released_seconds.set(gesture, released_seconds);
        if (released_seconds >= RELEASE_SECONDS || !is_face_found) {
          ended_now.push(gesture);
          this.fired.delete(gesture);
          this.released_seconds.delete(gesture);
        }
        continue;
      }
      this.released_seconds.delete(gesture);
      // Back within the release time: the counted gesture simply goes on.
      if (this.fired.has(gesture)) continue;
      const held_seconds = (this.held_seconds.get(gesture) ?? 0) + delta_seconds;
      this.held_seconds.set(gesture, held_seconds);
      if (held_seconds >= GESTURE_DEFINITIONS[gesture].hold_seconds) {
        this.fired.add(gesture);
        fired_now.push(gesture);
      }
    }
    return { started: fired_now, ended: ended_now };
  }
}
