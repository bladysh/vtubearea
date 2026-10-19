export type BackgroundMode = "transparent" | "color" | "chroma_key" | "media";
export type MediaFit = "cover" | "contain";
export type BackgroundMediaKind = "image" | "video";

export interface BackgroundMedia {
  file_name: string;
  /** URL the WebView can load (asset protocol or blob URL). */
  url: string;
  kind: BackgroundMediaKind;
}

export interface BackgroundSettings {
  mode: BackgroundMode;
  color: string;
  chroma_key_color: string;
  media: BackgroundMedia | null;
  media_fit: MediaFit;
  /** 0..1, lets the stream show through slightly darker or lighter media. */
  media_opacity: number;
}

export const CHROMA_KEY_PRESETS = [
  { id: "green", color: "#00b140" },
  { id: "blue", color: "#0047bb" },
  { id: "magenta", color: "#ff00ff" },
] as const;

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  mode: "color",
  color: "#0f1113",
  chroma_key_color: CHROMA_KEY_PRESETS[0].color,
  media: null,
  media_fit: "cover",
  media_opacity: 1,
};
