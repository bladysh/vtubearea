import { useEffect, useRef } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { webcam_tracking_session } from "../../../app/app_runtime";
import { LANDMARK_CONNECTIONS } from "../application/webcam_tracking_session";
import { ease_crop_box, face_crop_box, type CropBox } from "../domain/face_crop";

interface CameraPreviewProps {
  is_mirrored: boolean;
  /** Without the image only tracking is drawn, for people who do not want to see themselves. */
  shows_video: boolean;
  /** face: a square crop that follows the face; otherwise the whole camera picture. */
  focus?: "whole" | "face";
}

const FACE_COLOR = "#d1fe17";
const HAND_COLOR = "#ff7a9a";
const BACKGROUND_COLOR = "#0f1113";
/** Face crop: output size, and how fast the crop follows a moving head per frame. */
const FACE_CROP_PIXELS = 480;
const FACE_CROP_FOLLOW = 0.2;

type ToCanvas = (landmark: NormalizedLandmark) => [number, number];

function draw_connections(
  drawing_context: CanvasRenderingContext2D,
  landmarks: readonly NormalizedLandmark[],
  connections: readonly { start: number; end: number }[],
  to_canvas: ToCanvas,
): void {
  drawing_context.beginPath();
  for (const connection of connections) {
    const start_point = landmarks[connection.start];
    const end_point = landmarks[connection.end];
    if (!start_point || !end_point) continue;
    drawing_context.moveTo(...to_canvas(start_point));
    drawing_context.lineTo(...to_canvas(end_point));
  }
  drawing_context.stroke();
}

/** Camera image (optional) with the face outline and hand skeletons on top. */
export function CameraPreview({ is_mirrored, shows_video, focus = "whole" }: CameraPreviewProps) {
  const canvas_ref = useRef<HTMLCanvasElement>(null);
  const crop_box_ref = useRef<CropBox | null>(null);

  useEffect(() => {
    let animation_frame_id = 0;
    const draw_frame = () => {
      animation_frame_id = requestAnimationFrame(draw_frame);
      const canvas = canvas_ref.current;
      const video_element = webcam_tracking_session.camera_video;
      const drawing_context = canvas?.getContext("2d");
      if (!canvas || !drawing_context || !video_element || video_element.videoWidth === 0) return;

      const { videoWidth: video_width, videoHeight: video_height } = video_element;
      const { landmarks, hand_landmarks } = webcam_tracking_session.diagnostics;
      // The crop eases toward the face so small head moves do not shake the picture.
      let crop_box: CropBox = { left: 0, top: 0, size: 0 };
      if (focus === "face") {
        const target_box = landmarks?.length ? face_crop_box(landmarks, video_width, video_height) : crop_box_ref.current;
        const previous_box = crop_box_ref.current ?? target_box;
        crop_box =
          target_box && previous_box
            ? ease_crop_box(previous_box, target_box, FACE_CROP_FOLLOW)
            : { left: (video_width - video_height) / 2, top: 0, size: video_height };
        crop_box_ref.current = crop_box;
      }
      const [output_width, output_height] = focus === "face" ? [FACE_CROP_PIXELS, FACE_CROP_PIXELS] : [video_width, video_height];
      if (canvas.width !== output_width) canvas.width = output_width;
      if (canvas.height !== output_height) canvas.height = output_height;
      const to_canvas: ToCanvas =
        focus === "face"
          ? (landmark) => [((landmark.x * video_width - crop_box.left) / crop_box.size) * output_width, ((landmark.y * video_height - crop_box.top) / crop_box.size) * output_height]
          : (landmark) => [landmark.x * output_width, landmark.y * output_height];
      if (shows_video) {
        drawing_context.fillStyle = BACKGROUND_COLOR;
        drawing_context.fillRect(0, 0, canvas.width, canvas.height);
        if (focus === "face") drawing_context.drawImage(video_element, crop_box.left, crop_box.top, crop_box.size, crop_box.size, 0, 0, output_width, output_height);
        else drawing_context.drawImage(video_element, 0, 0, canvas.width, canvas.height);
      } else {
        drawing_context.fillStyle = BACKGROUND_COLOR;
        drawing_context.fillRect(0, 0, canvas.width, canvas.height);
      }

      const line_width = Math.max(1.5, canvas.width / 400);
      drawing_context.lineWidth = line_width;
      drawing_context.lineCap = "round";
      if (landmarks) {
        drawing_context.strokeStyle = FACE_COLOR;
        draw_connections(drawing_context, landmarks, LANDMARK_CONNECTIONS.face_contours, to_canvas);
      }
      if (focus === "face") return;
      drawing_context.strokeStyle = HAND_COLOR;
      drawing_context.fillStyle = HAND_COLOR;
      for (const hand of hand_landmarks) {
        draw_connections(drawing_context, hand, LANDMARK_CONNECTIONS.hand, to_canvas);
        for (const landmark of hand) {
          drawing_context.beginPath();
          drawing_context.arc(...to_canvas(landmark), line_width * 1.6, 0, Math.PI * 2);
          drawing_context.fill();
        }
      }
    };
    draw_frame();
    return () => cancelAnimationFrame(animation_frame_id);
  }, [shows_video, focus]);

  return <canvas ref={canvas_ref} className="camera-preview" data-mirrored={is_mirrored} data-focus={focus} />;
}
