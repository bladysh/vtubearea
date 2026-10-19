import { useEffect } from "react";
import { AppWindow, Image, Shapes } from "lucide-react";
import { Panel, TabBar, useTranslate } from "@vtubearea/ui";
import { useActiveTab } from "../../settings/application/settings_store";
import { useSceneStore } from "../application/scene_store";
import { BackgroundTab } from "./background_tab";
import { ItemsTab } from "./items_tab";
import { WindowTab } from "./window_tab";

const SCENE_TABS = ["background", "items", "window"] as const;
type SceneTab = (typeof SCENE_TABS)[number];

export function ScenePanel() {
  const translate = useTranslate();
  const [active_tab, set_active_tab] = useActiveTab<SceneTab>("scene", SCENE_TABS);
  const set_editing_items = useSceneStore((state) => state.set_editing_items);
  const tab_options = [
    { value: "background" as const, label: translate("scene.background"), icon: <Image size={14} /> },
    { value: "items" as const, label: translate("scene.items"), icon: <Shapes size={14} /> },
    { value: "window" as const, label: translate("scene.window"), icon: <AppWindow size={14} /> },
  ];

  // Items can be dragged on the stage only while their tab is open.
  useEffect(() => {
    set_editing_items(active_tab === "items");
    return () => set_editing_items(false);
  }, [active_tab, set_editing_items]);

  return (
    <Panel
      title={translate("scene.title")}
      subtitle={translate("scene.subtitle")}
      toolbar={<TabBar label={translate("scene.title")} value={active_tab} options={tab_options} on_change={set_active_tab} />}
    >
      {active_tab === "background" && <BackgroundTab />}
      {active_tab === "items" && <ItemsTab />}
      {active_tab === "window" && <WindowTab />}
    </Panel>
  );
}
