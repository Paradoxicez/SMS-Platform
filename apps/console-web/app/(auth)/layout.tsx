"use client";

import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { LicenseBanner } from "@/components/license-banner";
import { DatePrefsProvider } from "@/components/date-prefs-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DatePrefsProvider>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <NotificationBell />
          <div className="flex-1" />
        </header>
        <LicenseBanner />
        <main className="p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
    </DatePrefsProvider>
  );
}
