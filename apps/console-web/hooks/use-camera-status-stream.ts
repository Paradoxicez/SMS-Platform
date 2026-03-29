"use client";

import { useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export interface StatusChangeEvent {
  camera_id: string;
  previous_state: string;
  new_state: string;
  is_recording?: boolean;
  timestamp: string;
}

// ─── Shared singleton SSE connection ──────────────────────────────────────────
// Multiple hook instances share one EventSource so we don't open N connections.

type Listener = (event: StatusChangeEvent) => void;

let sharedES: EventSource | null = null;
let listeners = new Set<Listener>();
let connecting = false;

function addListener(fn: Listener) {
  listeners.add(fn);
  if (!sharedES && !connecting) {
    connecting = true;
    openConnection();
  }
}

function removeListener(fn: Listener) {
  listeners.delete(fn);
  if (listeners.size === 0 && sharedES) {
    sharedES.close();
    sharedES = null;
  }
}

async function openConnection() {
  // Get auth token for SSE query param (EventSource can't set headers)
  let token: string | null = null;
  try {
    const res = await fetch("/api/auth/session");
    if (res.ok) {
      const session = await res.json();
      token = session?.accessToken ?? null;
    }
  } catch {
    // No session
  }

  const url = token
    ? `${API_BASE}/cameras/status/stream?token=${encodeURIComponent(token)}`
    : `${API_BASE}/cameras/status/stream`;

  const es = new EventSource(url, { withCredentials: true });

  es.addEventListener("status_change", (e) => {
    try {
      const data = JSON.parse(e.data) as StatusChangeEvent;
      for (const fn of listeners) {
        fn(data);
      }
    } catch {
      // Skip malformed data
    }
  });

  es.addEventListener("error", () => {
    // EventSource auto-reconnects
  });

  sharedES = es;
  connecting = false;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribe to real-time camera status changes via SSE.
 * All hook instances share a single EventSource connection.
 */
export function useCameraStatusStream(
  onStatusChange: (event: StatusChangeEvent) => void,
) {
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  useEffect(() => {
    const handler: Listener = (event) => callbackRef.current(event);
    addListener(handler);
    return () => removeListener(handler);
  }, []);
}
