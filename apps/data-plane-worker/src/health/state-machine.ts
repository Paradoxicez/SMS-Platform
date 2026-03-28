/**
 * T059: Camera health state machine
 *
 * States: connecting, online, degraded, offline, reconnecting, stopped
 * Tracks state per camera and enforces valid transitions.
 */

export type CameraState =
  | "connecting"
  | "online"
  | "degraded"
  | "offline"
  | "reconnecting"
  | "stopping"
  | "stopped";

export type CameraEvent =
  | "rtsp_validated"
  | "first_frame"
  | "connection_lost"
  | "reconnected"
  | "max_backoff"
  | "flapping_detected"
  | "stable_period"
  | "manual_stop"
  | "manual_start";

/**
 * Valid state transitions map.
 * Key: current state -> event -> new state
 */
const transitions: Record<CameraState, Partial<Record<CameraEvent, CameraState>>> = {
  connecting: {
    rtsp_validated: "online",
    connection_lost: "offline",
    manual_stop: "stopping",
    max_backoff: "offline",
  },
  online: {
    connection_lost: "reconnecting",
    flapping_detected: "degraded",
    manual_stop: "stopping",
  },
  degraded: {
    stable_period: "online",
    connection_lost: "reconnecting",
    manual_stop: "stopping",
    max_backoff: "offline",
  },
  offline: {
    manual_start: "connecting",
    reconnected: "reconnecting",
    manual_stop: "stopping",
  },
  reconnecting: {
    first_frame: "online",
    reconnected: "online",
    connection_lost: "offline",
    max_backoff: "offline",
    flapping_detected: "degraded",
    manual_stop: "stopping",
  },
  stopping: {
    // Terminal transition once pipeline cleanup completes
    manual_stop: "stopped",
  },
  stopped: {
    manual_start: "connecting",
  },
};

export class CameraHealthStateMachine {
  private states: Map<string, CameraState> = new Map();

  getState(cameraId: string): CameraState {
    return this.states.get(cameraId) ?? "stopped";
  }

  setState(cameraId: string, state: CameraState): void {
    this.states.set(cameraId, state);
  }

  /**
   * Attempt a state transition for a camera.
   * Returns the new state on success, or throws if the transition is invalid.
   */
  transition(cameraId: string, event: CameraEvent): CameraState {
    const currentState = this.getState(cameraId);
    const stateTransitions = transitions[currentState];
    const newState = stateTransitions?.[event];

    if (!newState) {
      throw new Error(
        `Invalid transition: cannot apply event "${event}" in state "${currentState}" for camera ${cameraId}`,
      );
    }

    this.states.set(cameraId, newState);

    return newState;
  }

  /**
   * Get the previous and new state for a transition without applying it.
   * Returns null if the transition is invalid.
   */
  canTransition(cameraId: string, event: CameraEvent): CameraState | null {
    const currentState = this.getState(cameraId);
    return transitions[currentState]?.[event] ?? null;
  }

  removeCamera(cameraId: string): void {
    this.states.delete(cameraId);
  }
}
