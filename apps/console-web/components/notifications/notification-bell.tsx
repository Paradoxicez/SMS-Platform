"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications, type Notification } from "@/hooks/use-notifications";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function severityColor(type: string): string {
  if (type.includes("offline") || type.includes("deleted")) return "bg-red-500";
  if (type.includes("degraded")) return "bg-yellow-500";
  if (type.includes("denied") || type.includes("disabled")) return "bg-orange-500";
  if (type.includes("online") || type.includes("created") || type.includes("enabled")) return "bg-green-500";
  if (type.includes("role_changed")) return "bg-purple-500";
  return "bg-blue-500";
}

function NotificationItem({
  notification,
  onRead,
  onClick,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onClick: (link: string | null) => void;
}) {
  return (
    <button
      className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b last:border-b-0 ${
        !notification.read ? "bg-muted/30" : ""
      }`}
      onClick={() => {
        if (!notification.read) onRead(notification.id);
        onClick(notification.link);
      }}
    >
      <div className="flex items-start gap-2">
        <div
          className={`mt-1.5 size-2 shrink-0 rounded-full ${severityColor(notification.type)}`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {timeAgo(notification.createdAt)}
          </p>
        </div>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();
  const router = useRouter();

  const handleClick = (link: string | null) => {
    if (link) {
      router.push(link);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={markAsRead}
                onClick={handleClick}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
