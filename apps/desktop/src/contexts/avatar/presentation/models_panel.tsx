import { FolderOpen, Library, Move, Plus, RotateCcw, Smile } from "lucide-react";
import { Button, Panel, Section, SliderField, TabBar, useTranslate } from "@vtubearea/ui";
import { useActiveTab } from "../../settings/application/settings_store";
import { DEFAULT_VIEW_TRANSFORM, useAvatarStore } from "../application/avatar_store";
import { model_library_gateway } from "../infrastructure/model_library_gateway";
import { ExpressionsSection } from "./expressions_section";
import "./avatar.css";

const MODELS_TABS = ["library", "expressions", "placement"] as const;
type ModelsTab = (typeof MODELS_TABS)[number];

export function ModelsPanel() {
  const translate = useTranslate();
  const [active_tab, set_active_tab] = useActiveTab<ModelsTab>("models", MODELS_TABS);
  const tab_options = [
    { value: "library" as const, label: translate("models.library"), icon: <Library size={14} /> },
    { value: "expressions" as const, label: translate("models.expressions"), icon: <Smile size={14} /> },
    { value: "placement" as const, label: translate("models.placement"), icon: <Move size={14} /> },
  ];
  const models = useAvatarStore((state) => state.models);
  const active_model_id = useAvatarStore((state) => state.active_model_id);
  const load_status = useAvatarStore((state) => state.load_status);
  const load_error = useAvatarStore((state) => state.load_error);
  const view_transform = useAvatarStore((state) =>
    (state.active_model_id && state.view_transform_by_model[state.active_model_id]) || DEFAULT_VIEW_TRANSFORM,
  );
  const select_model = useAvatarStore((state) => state.select_model);
  const import_model = useAvatarStore((state) => state.import_model);
  const open_models_folder = useAvatarStore((state) => state.open_models_folder);
  const update_view_transform = useAvatarStore((state) => state.update_view_transform);
  const reset_view_transform = useAvatarStore((state) => state.reset_view_transform);

  return (
    <Panel
      title={translate("models.title")}
      subtitle={translate("models.subtitle")}
      toolbar={<TabBar label={translate("models.title")} value={active_tab} options={tab_options} on_change={set_active_tab} />}
    >
      {active_tab === "library" && (
      <Section
        actions={
          model_library_gateway.can_manage_files && (
            <Button size="small" variant="ghost" icon={<FolderOpen size={14} />} onClick={() => void open_models_folder()}>
              {translate("models.open_folder")}
            </Button>
          )
        }
      >
        <div className="model-grid">
          {models.map((model_summary) => (
            <button
              key={model_summary.id}
              type="button"
              className="model-card"
              aria-pressed={model_summary.id === active_model_id}
              onClick={() => void select_model(model_summary.id)}
            >
              <span className="model-card__avatar">{model_summary.display_name.slice(0, 1).toUpperCase()}</span>
              <span className="model-card__name">{model_summary.display_name}</span>
              <span className="model-card__status">
                {model_summary.id === active_model_id && load_status === "loading" ? translate("models.loading") : model_summary.id}
              </span>
            </button>
          ))}
        </div>
        {model_library_gateway.can_manage_files ? (
          <>
            <Button variant="primary" is_block icon={<Plus size={16} />} onClick={() => void import_model()}>
              {translate("models.import")}
            </Button>
            <p className="vta-field__hint">{translate("models.drop_hint")}</p>
          </>
        ) : (
          <p className="vta-field__hint">{translate("models.browser_hint")}</p>
        )}
        {load_error && <p className="error-text">{load_error}</p>}
      </Section>
      )}

      {active_tab === "expressions" && <ExpressionsSection />}

      {active_tab === "placement" && (
      <Section
        actions={
          <Button size="small" variant="ghost" icon={<RotateCcw size={14} />} onClick={reset_view_transform}>
            {translate("common.reset")}
          </Button>
        }
      >
        <SliderField
          label={translate("models.zoom")}
          hint={translate("models.zoom_hint")}
          value={view_transform.zoom}
          minimum={0.2}
          maximum={4}
          format_value={(value) => `${Math.round(value * 100)}%`}
          on_change={(zoom) => update_view_transform({ ...view_transform, zoom })}
        />
      </Section>
      )}
    </Panel>
  );
}
