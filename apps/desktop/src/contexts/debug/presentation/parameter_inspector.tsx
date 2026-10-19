import { useCallback } from "react";
import { Pin, PinOff } from "lucide-react";
import { Button, Tooltip, useTranslate } from "@vtubearea/ui";
import { avatar_control } from "../../../app/app_runtime";
import { useAvatarStore } from "../../avatar/application/avatar_store";
import { usePolledValue } from "../../../shared/use_polled_value";

/**
 * Live parameter values. Pinning a parameter overrides it through the same
 * control port an AI agent or plugin will use.
 */
export function ParameterInspector() {
  const translate = useTranslate();
  // Re-read the description when the model changes.
  const loaded_model = useAvatarStore((state) => state.loaded_model);
  const read_values = useCallback(
    () => ({ values: avatar_control.get_parameter_values(), overrides: avatar_control.get_parameter_overrides() }),
    [],
  );
  const { values, overrides } = usePolledValue(read_values, 100);
  const model_description = loaded_model ? avatar_control.describe_model() : null;
  if (!model_description) return <p className="vta-field__hint">{translate("debug.no_model")}</p>;

  return (
    <div className="parameter-list">
      {Object.keys(overrides).length > 0 && (
        <Button size="small" variant="ghost" onClick={() => avatar_control.clear_parameter_overrides()}>
          {translate("debug.clear_overrides")}
        </Button>
      )}
      {model_description.parameters.map((parameter) => {
        const value = values[parameter.id] ?? parameter.default_value;
        const is_pinned = parameter.id in overrides;
        const fill_percent = ((value - parameter.minimum) / (parameter.maximum - parameter.minimum)) * 100;
        return (
          <div key={parameter.id} className="parameter-row" data-pinned={is_pinned}>
            <Tooltip text={translate(is_pinned ? "debug.unpin" : "debug.pin")}>
              <button
                type="button"
                className="parameter-row__pin"
                aria-label={translate(is_pinned ? "debug.unpin" : "debug.pin")}
                onClick={() =>
                  is_pinned
                    ? avatar_control.clear_parameter_overrides([parameter.id])
                    : avatar_control.set_parameter_overrides({ [parameter.id]: value })
                }
              >
                {is_pinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
            </Tooltip>
            <Tooltip text={parameter.display_name}>
              <span className="parameter-row__name">{parameter.id}</span>
            </Tooltip>
            {is_pinned ? (
              <input
                className="vta-slider parameter-row__slider"
                type="range"
                aria-label={parameter.id}
                min={parameter.minimum}
                max={parameter.maximum}
                step={(parameter.maximum - parameter.minimum) / 200}
                value={value}
                onChange={(change_event) => avatar_control.set_parameter_overrides({ [parameter.id]: Number(change_event.target.value) })}
              />
            ) : (
              <span className="meter__track">
                <span className="meter__fill" style={{ width: `${fill_percent}%` }} />
              </span>
            )}
            <span className="parameter-row__value">{value.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}
