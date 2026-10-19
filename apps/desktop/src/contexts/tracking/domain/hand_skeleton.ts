import type { HandPose } from "@vtubearea/protocol";
import { OneEuroFilter } from "./one_euro_filter";

/** [x, y] in camera-frame-height units, origin at the frame center, x to the screen right, y down. */
export type SkeletonPoint = [number, number];

export interface TrackedHandSkeleton {
  /** 21 points in MediaPipe order. */
  points: SkeletonPoint[];
  /** False once the hand has been missing longer than the hold time; points keep the last pose. */
  is_present: boolean;
  /** Farther from the camera than the face, so the avatar's head should cover it. */
  is_behind_head: boolean;
}

/**
 * Puts hand landmarks into the picture the user sees: mirrored if needed and with
 * correct proportions (x is stretched by the aspect ratio, so a square stays square).
 */
export function to_view_space_points(hand_pose: HandPose, image_aspect_ratio: number, is_mirrored: boolean): SkeletonPoint[] {
  return hand_pose.landmarks.map(([image_x, image_y]) => {
    const view_x = is_mirrored ? 1 - image_x : image_x;
    return [(view_x - 0.5) * image_aspect_ratio, image_y - 0.5];
  });
}

/** One Euro filter per coordinate: steady fingers at rest, little lag when they move. */
export class HandSkeletonSmoother {
  private filters: OneEuroFilter[] = [];

  constructor(
    private minimum_cutoff_hertz: number,
    private speed_coefficient: number,
  ) {}

  update_settings(minimum_cutoff_hertz: number, speed_coefficient: number): void {
    this.minimum_cutoff_hertz = minimum_cutoff_hertz;
    this.speed_coefficient = speed_coefficient;
    for (const filter of this.filters) {
      filter.minimum_cutoff_hertz = minimum_cutoff_hertz;
      filter.speed_coefficient = speed_coefficient;
    }
  }

  smooth(points: readonly SkeletonPoint[], time_seconds: number): SkeletonPoint[] {
    return points.map((point, point_index) => [
      this.filter_at(point_index * 2).filter(point[0], time_seconds),
      this.filter_at(point_index * 2 + 1).filter(point[1], time_seconds),
    ]);
  }

  reset(): void {
    for (const filter of this.filters) filter.reset();
  }

  private filter_at(filter_index: number): OneEuroFilter {
    this.filters[filter_index] ??= new OneEuroFilter(this.minimum_cutoff_hertz, this.speed_coefficient);
    return this.filters[filter_index];
  }
}
