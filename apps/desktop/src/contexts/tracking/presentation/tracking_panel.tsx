import type { ReactNode } from "react";
import { Camera, CameraOff, Hand, ScanFace, SlidersHorizontal, Smile, Wind } from "lucide-react";
import { Badge, Button, IconButton, Panel, TabBar, useTranslate } from "@vtubearea/ui";
import { tracking_hub } from "../../../app/app_runtime";
import { usePolledValue } from "../../../shared/use_polled_value";
import { useActiveTab } from "../../settings/application/settings_store";
import { useTrackingStore } from "../application/tracking_store";
import { CameraTab } from "./camera_tab";
import { FaceTab } from "./face_tab";
import { HandsTab } from "./hands_tab";
import "./tracking.css";

const TRACKING_TABS = ["camera", "face", "hands", "gestures", "motion", "mapping"] as const;
type TrackingTab = (typeof TRACKING_TABS)[number];

const read_face_found = () => tracking_hub.snapshot().is_face_found;

interface TrackingPanelProps {
  /** Tabs owned by the avatar context, passed in by the app shell. */
  gestures_tab: ReactNode;
  motion_tab: ReactNode;
  mapping_tab: ReactNode;
}

export function TrackingPanel({ gestures_tab, motion_tab, mapping_tab }: TrackingPanelProps) {
  const translate = useTranslate();
  const [active_tab, set_active_tab] = useActiveTab<TrackingTab>("tracking", TRACKING_TABS);
  const session_status = useTrackingStore((state) => state.session_status);
  const start_tracking = useTrackingStore((state) => state.start_tracking);
  const stop_tracking = useTrackingStore((state) => state.stop_tracking);
  const is_face_found = usePolledValue(read_face_found, 200);
  const is_running = session_status === "running";

  const tab_options = [
    { value: "camera" as const, label: translate("tracking.tab.camera"), icon: <Camera size={14} /> },
    { value: "face" as const, label: translate("tracking.tab.face"), icon: <ScanFace size={14} /> },
    { value: "hands" as const, label: translate("tracking.tab.hands"), icon: <Hand size={14} /> },
    { value: "gestures" as const, label: translate("tracking.tab.gestures"), icon: <Smile size={14} /> },
    { value: "motion" as const, label: translate("tracking.tab.motion"), icon: <Wind size={14} /> },
    { value: "mapping" as const, label: translate("tracking.tab.mapping"), icon: <SlidersHorizontal size={14} /> },
  ];

  const header_actions = is_running ? (
    <div className="tracking-header">
      <Badge tone={is_face_found ? "success" : "danger"}>
        {translate(is_face_found ? "tracking.face_found" : "tracking.face_lost")}
      </Badge>
      <IconButton label={translate("tracking.stop")} icon={<CameraOff size={14} />} onClick={stop_tracking} />
    </div>
  ) : (
    <Button size="small" variant="primary" icon={<Camera size={14} />} disabled={session_status === "starting"} onClick={() => void start_tracking()}>
      {translate(session_status === "starting" ? "tracking.starting" : "tracking.start_short")}
    </Button>
  );

  return (
    <Panel
      title={translate("tracking.title")}
      subtitle={translate("tracking.subtitle")}
      header_actions={header_actions}
      toolbar={<TabBar label={translate("tracking.title")} value={active_tab} options={tab_options} on_change={set_active_tab} />}
    >
      {active_tab === "camera" && <CameraTab />}
      {active_tab === "face" && <FaceTab />}
      {active_tab === "hands" && <HandsTab />}
      {active_tab === "gestures" && gestures_tab}
      {active_tab === "motion" && motion_tab}
      {active_tab === "mapping" && mapping_tab}
    </Panel>
  );
}
