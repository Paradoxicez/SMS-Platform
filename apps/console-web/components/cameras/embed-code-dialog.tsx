"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Copy } from "lucide-react";

interface EmbedCodeDialogProps {
  open: boolean;
  onClose: () => void;
  cameraId: string;
  cameraName: string;
}

export function EmbedCodeDialog({
  open,
  onClose,
  cameraId,
  cameraName,
}: EmbedCodeDialogProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-platform.com";

  const iframeSnippet = `<iframe
  src="${baseUrl}/embed/${cameraId}?key=YOUR_API_KEY"
  width="640"
  height="360"
  frameborder="0"
  allowfullscreen
></iframe>`;

  const scriptSnippet = `<!-- HLS.js Embed for ${cameraName} -->
<video id="camera-${cameraId}" controls muted style="width:640px;height:360px;background:#000"></video>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
(async function() {
  const API_KEY = 'YOUR_API_KEY';
  const res = await fetch('${baseUrl}/api/v1/playback/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ camera_id: '${cameraId}' }),
  });
  const { data } = await res.json();
  const video = document.getElementById('camera-${cameraId}');
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(data.playback_url);
    hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = data.playback_url;
  }
})();
</script>`;

  async function handleCopy(text: string, tab: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tab);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch {
      // Clipboard write failed
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Embed Code</DialogTitle>
          <DialogDescription>
            Embed the <strong>{cameraName}</strong> camera stream on your website.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="iframe" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="iframe">iframe</TabsTrigger>
            <TabsTrigger value="script">Script (hls.js)</TabsTrigger>
          </TabsList>

          <TabsContent value="iframe" className="space-y-3">
            <div className="relative">
              <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto break-all whitespace-pre-wrap">
                <code>{iframeSnippet}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => handleCopy(iframeSnippet, "iframe")}
              >
                {copiedTab === "iframe" ? (
                  <>
                    <Check className="mr-1 size-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 size-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="script" className="space-y-3">
            <div className="relative">
              <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto break-all whitespace-pre-wrap max-h-64 overflow-y-auto">
                <code>{scriptSnippet}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => handleCopy(scriptSnippet, "script")}
              >
                {copiedTab === "script" ? (
                  <>
                    <Check className="mr-1 size-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 size-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="rounded-lg bg-muted/50 border p-3">
          <p className="text-xs text-muted-foreground">
            <Badge variant="outline" className="mr-1">
              Note
            </Badge>
            Replace <code className="font-mono text-xs">YOUR_API_KEY</code> with
            your actual API key from the{" "}
            <a href="/developer" className="underline">
              Developer portal
            </a>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
