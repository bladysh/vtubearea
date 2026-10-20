import type { ReactElement } from "react";
import type { FaceGesture } from "../domain/face_gesture";

type EyeShape = "open" | "closed";
type BrowShape = "rest" | "raised" | "lowered";
type MouthShape = "rest" | "open" | "smile" | "sad";

interface FacePose {
  eyes: readonly [EyeShape, EyeShape];
  brows: BrowShape;
  mouth: MouthShape;
  tilt_degrees: number;
}

const RELAXED: FacePose = { eyes: ["open", "open"], brows: "rest", mouth: "rest", tilt_degrees: 0 };

/** The face to pull, drawn as seen in the (mirrored) camera preview. */
const POSES: Record<FaceGesture, FacePose> = {
  wink_left: { ...RELAXED, eyes: ["closed", "open"], mouth: "smile" },
  wink_right: { ...RELAXED, eyes: ["open", "closed"], mouth: "smile" },
  brows_raised: { ...RELAXED, brows: "raised", mouth: "open" },
  brows_lowered: { ...RELAXED, brows: "lowered" },
  mouth_wide_open: { ...RELAXED, mouth: "open" },
  big_smile: { ...RELAXED, mouth: "smile" },
  sad_mouth: { ...RELAXED, mouth: "sad" },
  head_tilt_left: { ...RELAXED, tilt_degrees: -20 },
  head_tilt_right: { ...RELAXED, tilt_degrees: 20 },
};

const EYE_X = [-9, 9] as const;
const BROW_Y: Record<BrowShape, number> = { rest: -13, raised: -18, lowered: -10 };

const MOUTHS: Record<MouthShape, ReactElement> = {
  rest: <path d="M -6 10 L 6 10" />,
  open: <ellipse cx={0} cy={11} rx={5} ry={6} />,
  smile: <path d="M -9 8 Q 0 17 9 8" />,
  sad: <path d="M -7 13 Q 0 7 7 13" />,
};

/** A line drawing of the face that shows a gesture: the "picture" next to it in the settings. */
export function GesturePictogram({ gesture }: { gesture: FaceGesture }) {
  const pose = POSES[gesture];
  const brow_y = BROW_Y[pose.brows];
  return (
    <svg className="gesture-pictogram" viewBox="-30 -30 60 60" aria-hidden="true">
      <g transform={`rotate(${pose.tilt_degrees})`}>
        <circle className="gesture-pictogram__face" r={24} />
        {EYE_X.map((eye_x, eye_index) => (
          <g key={eye_x}>
            {pose.eyes[eye_index] === "open" ? (
              <circle className="gesture-pictogram__eye" cx={eye_x} cy={-4} r={2.6} />
            ) : (
              <path d={`M ${eye_x - 4} -3 Q ${eye_x} 0 ${eye_x + 4} -3`} />
            )}
            {/* Lowered brows slant down towards the nose. */}
            <path d={`M ${eye_x - 5} ${brow_y} L ${eye_x + 5} ${pose.brows === "lowered" ? brow_y + (eye_x < 0 ? 3 : -3) : brow_y}`} />
          </g>
        ))}
        {MOUTHS[pose.mouth]}
      </g>
    </svg>
  );
}
