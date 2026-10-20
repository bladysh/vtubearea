import { useCallback, useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { Button, RangeMeter, Section, useTranslate } from "@vtubearea/ui";
import { avatar_control, tracking_hub } from "../../../app/app_runtime";
import { usePolledValue } from "../../../shared/use_polled_value";
import { useAvatarStore } from "../application/avatar_store";
import { mappings_with_defaults } from "../domain/default_parameter_mappings";
import type { ParameterMapping } from "../domain/parameter_mapping";

type NumericMappingField = "input_minimum" | "input_maximum" | "output_minimum" | "output_maximum" | "smoothing";

const NUMERIC_FIELDS: readonly NumericMappingField[] = [
  "input_minimum",
  "input_maximum",
  "output_minimum",
  "output_maximum",
  "smoothing",
];

/** Expert table, same idea as VTube Studio parameter settings: input range -> output range. */
export function ParameterMappingEditor() {
  const translate = useTranslate();
  const active_model_id = useAvatarStore((state) => state.active_model_id);
  const model_definition = useAvatarStore((state) => state.loaded_model?.model_definition);
  const saved_mappings = useAvatarStore((state) => (state.active_model_id ? state.mappings_by_model[state.active_model_id] : undefined));
  const update_mapping = useAvatarStore((state) => state.update_mapping);
  const reset_mappings = useAvatarStore((state) => state.reset_mappings);

  const mappings: ParameterMapping[] = useMemo(
    () => (model_definition ? mappings_with_defaults(saved_mappings, model_definition.parameters) : []),
    [saved_mappings, model_definition],
  );

  // Live input and output per row, like VTube Studio's parameter bars.
  const read_live_values = useCallback(
    () => ({ inputs: tracking_hub.snapshot().input_values, outputs: avatar_control.get_parameter_values() }),
    [],
  );
  const live_values = usePolledValue(read_live_values, 100);
  const format_number = (value: number) => value.toFixed(2);

  if (!active_model_id || mappings.length === 0) return null;
  return (
    <Section
      title={translate("mapping.title")}
      actions={
        <Button size="small" variant="ghost" icon={<RotateCcw size={14} />} onClick={reset_mappings}>
          {translate("common.reset")}
        </Button>
      }
    >
      <p className="vta-field__hint">{translate("mapping.hint")}</p>
      <div className="mapping-list">
        {mappings.map((mapping) => (
          <div key={mapping.id} className="mapping-row" data-disabled={!mapping.is_enabled}>
            <label className="mapping-row__title">
              <input
                type="checkbox"
                checked={mapping.is_enabled}
                onChange={(change_event) => update_mapping(mapping.id, { is_enabled: change_event.target.checked })}
              />
              <span>{mapping.input_name}</span>
              <span className="mapping-row__arrow">→</span>
              <span>{mapping.output_parameter_id}</span>
            </label>
            <RangeMeter
              label={translate("mapping.live_input")}
              value={live_values.inputs[mapping.input_name]}
              minimum={mapping.input_minimum}
              maximum={mapping.input_maximum}
              format_value={format_number}
            />
            <RangeMeter
              label={translate("mapping.live_output")}
              value={live_values.outputs[mapping.output_parameter_id]}
              minimum={mapping.output_minimum}
              maximum={mapping.output_maximum}
              format_value={format_number}
            />
            <div className="mapping-row__fields">
              {NUMERIC_FIELDS.map((field_name) => (
                <label key={field_name} className="mapping-row__field">
                  <span>{translate(`mapping.${field_name}`)}</span>
                  <input
                    className="vta-number-input"
                    type="number"
                    step={field_name === "smoothing" ? 1 : 0.05}
                    value={mapping[field_name]}
                    onChange={(change_event) => {
                      const numeric_value = Number(change_event.target.value);
                      if (Number.isFinite(numeric_value)) update_mapping(mapping.id, { [field_name]: numeric_value });
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
