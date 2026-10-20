import type { CSSProperties } from "react";
import { RotateCcw } from "lucide-react";
import { Badge, IconButton, Section, SliderField, useTranslate } from "@vtubearea/ui";
import { tracking_hub } from "../../../app/app_runtime";
import { usePolledValue } from "../../../shared/use_polled_value";
import { useAvatarStore } from "../application/avatar_store";
import {
  FACE_GESTURES,
  gesture_strength,
  gesture_threshold,
  read_gesture,
  threshold_for_strength,
  weakest_strength,
  type FaceGesture,
  type GestureTrigger,
} from "../domain/face_gesture";
import { GesturePictogram } from "./gesture_pictogram";

const read_tracking = () => tracking_hub.snapshot();
const NO_GESTURES: Record<string, GestureTrigger | undefined> = {};
/** Fast enough to see a wink land, slow enough to keep nine cards cheap. */
const LIVE_INTERVAL_MS = 100;

const as_percent = (share: number) => `${Math.round(share * 100)}%`;

/** Every face gesture the app can read: what to pull, whether it reads right now, and how strongly it must be shown. */
export function GesturesTab() {
  const translate = useTranslate();
  const { is_face_found, input_values } = usePolledValue(read_tracking, LIVE_INTERVAL_MS);
  const thresholds = useAvatarStore((state) => state.gesture_thresholds);
  const set_gesture_threshold = useAvatarStore((state) => state.set_gesture_threshold);
  const expressions = useAvatarStore((state) => state.loaded_model?.model_definition.expressions);
  const triggers = useAvatarStore((state) => (state.active_model_id ? (state.expression_gestures_by_model[state.active_model_id] ?? NO_GESTURES) : NO_GESTURES));

  const expression_names_for = (gesture: FaceGesture) =>
    Object.entries(triggers)
      .filter(([, trigger]) => trigger?.gesture === gesture)
      .map(([expression_id]) => expressions?.find((expression) => expression.id === expression_id)?.display_name ?? expression_id);

  return (
    <>
      <Section>
        <p className="vta-field__hint">{translate(is_face_found ? "gestures.hint" : "gestures.no_face")}</p>
      </Section>
      {FACE_GESTURES.map((gesture) => {
        const { value, is_shown } = read_gesture(gesture, input_values, thresholds);
        const live_strength = is_face_found ? gesture_strength(gesture, value) : 0;
        const needed_strength = gesture_strength(gesture, gesture_threshold(gesture, thresholds));
        const expression_names = expression_names_for(gesture);
        const meter_style = { "--gesture-live": as_percent(live_strength), "--gesture-needed": as_percent(needed_strength) } as CSSProperties;
        return (
          <Section
            key={gesture}
            title={translate(`expressions.gesture.${gesture}`)}
            actions={
              <div className="gesture-card__actions">
                {is_face_found && is_shown && <Badge tone="success">{translate("gestures.detected")}</Badge>}
                <IconButton
                  label={translate("common.reset")}
                  icon={<RotateCcw size={14} />}
                  disabled={thresholds[gesture] === undefined}
                  onClick={() => set_gesture_threshold(gesture, null)}
                />
              </div>
            }
          >
            <div className="gesture-card">
              <GesturePictogram gesture={gesture} />
              <div className="gesture-card__body">
                <p className="vta-field__hint">{translate(`gestures.how.${gesture}`)}</p>
                <div
                  className={["gesture-meter", is_face_found && is_shown && "gesture-meter--shown"].filter(Boolean).join(" ")}
                  role="meter"
                  aria-label={translate("gestures.live")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(live_strength * 100)}
                  style={meter_style}
                >
                  <span className="gesture-meter__fill" />
                  <span className="gesture-meter__needed" />
                </div>
                <p className="gesture-card__used-by">
                  {expression_names.length > 0
                    ? translate("gestures.used_by", { expressions: expression_names.join(", ") })
                    : translate("gestures.unused")}
                </p>
              </div>
            </div>
            <SliderField
              label={translate("gestures.needed")}
              hint={translate("gestures.needed_hint")}
              value={needed_strength}
              minimum={weakest_strength(gesture)}
              maximum={1}
              format_value={as_percent}
              on_change={(strength) => set_gesture_threshold(gesture, threshold_for_strength(gesture, strength))}
            />
          </Section>
        );
      })}
    </>
  );
}
