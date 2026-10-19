import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open as open_file_dialog } from "@tauri-apps/plugin-dialog";
import { is_desktop_runtime } from "../../../shared/platform";
import type { BackgroundMedia, BackgroundMediaKind } from "../domain/background_settings";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov"];

interface MediaAssetDto {
  file_name: string;
  file_path: string;
  kind: BackgroundMediaKind;
}

/** A folder of user media managed by the Rust core: backgrounds or scene items. */
export interface MediaGateway {
  list_media(): Promise<BackgroundMedia[]>;
  /** Resolves to null when the user cancels. */
  pick_and_import_media(): Promise<BackgroundMedia | null>;
  import_media_from_path(source_path: string): Promise<BackgroundMedia>;
  delete_media(file_name: string): Promise<void>;
}

interface MediaFolder {
  list_command: string;
  import_command: string;
  delete_command: string;
  allows_video: boolean;
  dialog_title: string;
}

function to_media(asset: MediaAssetDto): BackgroundMedia {
  return { file_name: asset.file_name, url: convertFileSrc(asset.file_path), kind: asset.kind };
}

function create_desktop_media_gateway(media_folder: MediaFolder): MediaGateway {
  const extensions = media_folder.allows_video ? [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] : IMAGE_EXTENSIONS;
  const gateway: MediaGateway = {
    list_media: async () => (await invoke<MediaAssetDto[]>(media_folder.list_command)).map(to_media),
    pick_and_import_media: async () => {
      const selected_file = await open_file_dialog({ multiple: false, filters: [{ name: media_folder.dialog_title, extensions }] });
      return typeof selected_file === "string" ? gateway.import_media_from_path(selected_file) : null;
    },
    import_media_from_path: async (source_path) => to_media(await invoke<MediaAssetDto>(media_folder.import_command, { sourcePath: source_path })),
    delete_media: (file_name) => invoke<void>(media_folder.delete_command, { fileName: file_name }),
  };
  return gateway;
}

/** Browser fallback keeps picked files in memory for the session only. */
function create_browser_media_gateway(media_folder: MediaFolder): MediaGateway {
  const session_media: BackgroundMedia[] = [];
  return {
    list_media: async () => [...session_media],
    pick_and_import_media: () =>
      new Promise((resolve) => {
        const file_input = document.createElement("input");
        file_input.type = "file";
        file_input.accept = media_folder.allows_video ? "image/*,video/*" : "image/*";
        file_input.onchange = () => {
          const picked_file = file_input.files?.[0];
          if (!picked_file) return resolve(null);
          const media: BackgroundMedia = {
            file_name: picked_file.name,
            url: URL.createObjectURL(picked_file),
            kind: picked_file.type.startsWith("video/") ? "video" : "image",
          };
          session_media.push(media);
          resolve(media);
        };
        file_input.click();
      }),
    import_media_from_path: async () => {
      throw new Error("Importing by path needs the desktop app");
    },
    delete_media: async (file_name) => {
      const media_index = session_media.findIndex((media) => media.file_name === file_name);
      if (media_index >= 0) URL.revokeObjectURL(session_media.splice(media_index, 1)[0]!.url);
    },
  };
}

function create_media_gateway(media_folder: MediaFolder): MediaGateway {
  return is_desktop_runtime ? create_desktop_media_gateway(media_folder) : create_browser_media_gateway(media_folder);
}

export const background_media_gateway = create_media_gateway({
  list_command: "list_backgrounds",
  import_command: "import_background",
  delete_command: "delete_background",
  allows_video: true,
  dialog_title: "Images and videos",
});

export const item_media_gateway = create_media_gateway({
  list_command: "list_items",
  import_command: "import_item",
  delete_command: "delete_item",
  allows_video: false,
  dialog_title: "Images",
});

export function is_background_media_path(file_path: string): boolean {
  const extension = file_path.split(".").pop()?.toLowerCase() ?? "";
  return [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].includes(extension);
}
