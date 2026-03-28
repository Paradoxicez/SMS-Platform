"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "../lib/api-client";

export interface Notification {
  id: string;
  userId: string;
  tenantId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Notification[] }>(
        "/notifications",
      );
      setNotifications(res.data);
      setUnreadCount(res.data.filter((n) => !n.read).length);
    } catch {
      // API unavailable
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: { count: number } }>(
        "/notifications/unread-count",
      );
      setUnreadCount(res.data.count);
    } catch {
      // API unavailable
    }
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiClient.post(`/notifications/${notificationId}/read`, {});
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Handle error
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.post("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Handle error
    }
  }, []);

  // Connect to SSE
  useEffect(() => {
    fetchNotifications();

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
      const es = new EventSource(`${baseUrl}/notifications/stream`, {
        withCredentials: true,
      });

      es.addEventListener("notification", (event) => {
        try {
          const notification = JSON.parse(event.data) as Notification;
          setNotifications((prev) => [notification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        } catch {
          // Invalid data
        }
      });

      es.addEventListener("error", () => {
        // SSE connection error, will auto-reconnect
      });

      eventSourceRef.current = es;
    } catch {
      // SSE not available
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
