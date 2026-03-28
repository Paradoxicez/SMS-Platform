/**
 * T060: Flapping detector
 *
 * Tracks state transitions per camera in a sliding window (2 minutes).
 * If >= 5 transitions in the window, the camera is considered flapping.
 */

const DEFAULT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const DEFAULT_THRESHOLD = 5;

export class FlappingDetector {
  private transitionLog: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly threshold: number;

  constructor(
    windowMs: number = DEFAULT_WINDOW_MS,
    threshold: number = DEFAULT_THRESHOLD,
  ) {
    this.windowMs = windowMs;
    this.threshold = threshold;
  }

  /**
   * Record a state transition for a camera.
   * Returns true if the camera is now flapping after this transition.
   */
  recordTransition(cameraId: string): boolean {
    const now = Date.now();
    let timestamps = this.transitionLog.get(cameraId);

    if (!timestamps) {
      timestamps = [];
      this.transitionLog.set(cameraId, timestamps);
    }

    timestamps.push(now);

    // Prune old entries outside the sliding window
    const cutoff = now - this.windowMs;
    const pruned = timestamps.filter((t) => t >= cutoff);
    this.transitionLog.set(cameraId, pruned);

    return pruned.length >= this.threshold;
  }

  /**
   * Check if a camera is currently flapping without recording a new transition.
   */
  isFlapping(cameraId: string): boolean {
    const now = Date.now();
    const timestamps = this.transitionLog.get(cameraId);

    if (!timestamps) {
      return false;
    }

    const cutoff = now - this.windowMs;
    const recent = timestamps.filter((t) => t >= cutoff);

    // Update stored timestamps (pruning old entries)
    this.transitionLog.set(cameraId, recent);

    return recent.length >= this.threshold;
  }

  /**
   * Reset transition history for a camera.
   */
  reset(cameraId: string): void {
    this.transitionLog.delete(cameraId);
  }

  /**
   * Get the number of transitions in the current window for a camera.
   */
  getTransitionCount(cameraId: string): number {
    const now = Date.now();
    const timestamps = this.transitionLog.get(cameraId);

    if (!timestamps) {
      return 0;
    }

    const cutoff = now - this.windowMs;
    return timestamps.filter((t) => t >= cutoff).length;
  }
}
