import type { CSSProperties } from "react";
import { useSceneStore } from "../application/scene_store";

export function BackgroundLayer() {
  const background = useSceneStore((state) => state.background);

  if (background.mode === "transparent") return null;
  if (background.mode === "color" || background.mode === "chroma_key") {
    const background_color = background.mode === "color" ? background.color : background.chroma_key_color;
    return <div className="stage__background" style={{ background: background_color }} />;
  }
  if (!background.media) return <div className="stage__background" style={{ background: background.color }} />;

  const media_style: CSSProperties = { objectFit: background.media_fit, opacity: background.media_opacity };
  return (
    <div className="stage__background" style={{ background: background.color }}>
      {background.media.kind === "video" ? (
        <video className="stage__media" src={background.media.url} style={media_style} autoPlay loop muted playsInline />
      ) : (
        <img className="stage__media" src={background.media.url} style={media_style} alt="" draggable={false} />
      )}
    </div>
  );
}
