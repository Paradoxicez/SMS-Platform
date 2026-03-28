import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthSessionProvider } from "@/components/session-provider";

const ibmPlexSans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "CCTV Platform Console",
  description: "B2B CCTV Streaming Platform management console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", ibmPlexSans.variable)} suppressHydrationWarning>
      <body>
        <AuthSessionProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
