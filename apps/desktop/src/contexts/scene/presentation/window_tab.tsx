import { Section, ToggleField, useTranslate } from "@vtubearea/ui";
import { useSceneStore } from "../application/scene_store";

export function WindowTab() {
  const translate = useTranslate();
  const is_always_on_top = useSceneStore((state) => state.is_always_on_top);
  const is_click_through = useSceneStore((state) => state.is_click_through);
  const change_always_on_top = useSceneStore((state) => state.change_always_on_top);
  const change_click_through = useSceneStore((state) => state.change_click_through);

  return (
    <Section>
      <ToggleField
        label={translate("scene.always_on_top")}
        hint={translate("scene.always_on_top_hint")}
        is_checked={is_always_on_top}
        on_change={(is_enabled) => void change_always_on_top(is_enabled)}
      />
      <ToggleField
        label={translate("scene.click_through")}
        hint={translate("scene.click_through_hint")}
        is_checked={is_click_through}
        on_change={(is_enabled) => void change_click_through(is_enabled)}
      />
      <p className="vta-field__hint">{translate("scene.obs_hint")}</p>
    </Section>
  );
}
