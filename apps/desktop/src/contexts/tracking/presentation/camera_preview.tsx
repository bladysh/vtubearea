import { useEffect, useRef } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { webcam_tracking_session } from "../../../app/app_runtime";
import { LANDMARK_CONNECTIONS } from "../application/webcam_tracking_session";

interface CameraPreviewProps {
  is_mirrored: boolean;
  /** Without the image only tracking is drawn, for people who do not want to see themselves. */
  shows_video: boolean;
}

const FACE_COLOR = "#d1fe17";
const HAND_COLOR = "#ff7a9a";
const BACKGROUND_COLOR = "#0f1113";

function draw_connections(
  drawing_context: CanvasRenderingContext2D,
  landmarks: readonly NormalizedLandmark[],
  connections: readonly { start: number; end: number }[],
  canvas_width: number,
  canvas_height: number,
): void {
  drawing_context.beginPath();
  for (const connection of connections) {
    const start_point = landmarks[connection.start];
    const end_point = landmarks[connection.end];
    if (!start_point || !end_point) continue;
    drawing_context.moveTo(start_point.x * canvas_width, start_point.y * canvas_height);
    drawing_context.lineTo(end_point.x * canvas_width, end_point.y * canvas_height);
  }
  drawing_context.stroke();
}

/** Camera image (optional) with the face outline and hand skeletons on top. */
export function CameraPreview({ is_mirrored, shows_video }: CameraPreviewProps) {
  const canvas_ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animation_frame_id = 0;
    const draw_frame = () => {
      animation_frame_id = requestAnimationFrame(draw_frame);
      const canvas = canvas_ref.current;
      const video_element = webcam_tracking_session.camera_video;
      const drawing_context = canvas?.getContext("2d");
      if (!canvas || !drawing_context || !video_element || video_element.videoWidth === 0) return;

      if (canvas.width !== video_element.videoWidth) canvas.width = video_element.videoWidth;
      if (canvas.height !== video_element.videoHeight) canvas.height = video_element.videoHeight;
      if (shows_video) {
        drawing_context.drawImage(video_element, 0, 0, canvas.width, canvas.height);
      } else {
        drawing_context.fillStyle = BACKGROUND_COLOR;
        drawing_context.fillRect(0, 0, canvas.width, canvas.height);
      }

      const { landmarks, hand_landmarks } = webcam_tracking_session.diagnostics;
      const line_width = Math.max(1.5, canvas.width / 400);
      drawing_context.lineWidth = line_width;
      drawing_context.lineCap = "round";
      if (landmarks) {
        drawing_context.strokeStyle = FACE_COLOR;
        draw_connections(drawing_context, landmarks, LANDMARK_CONNECTIONS.face_contours, canvas.width, canvas.height);
      }
      drawing_context.strokeStyle = HAND_COLOR;
      drawing_context.fillStyle = HAND_COLOR;
      for (const hand of hand_landmarks) {
        draw_connections(drawing_context, hand, LANDMARK_CONNECTIONS.hand, canvas.width, canvas.height);
        for (const landmark of hand) {
          drawing_context.beginPath();
          drawing_context.arc(landmark.x * canvas.width, landmark.y * canvas.height, line_width * 1.6, 0, Math.PI * 2);
          drawing_context.fill();
        }
      }
    };
    draw_frame();
    return () => cancelAnimationFrame(animation_frame_id);
  }, [shows_video]);

  return <canvas ref={canvas_ref} className="camera-preview" data-mirrored={is_mirrored} />;
}
