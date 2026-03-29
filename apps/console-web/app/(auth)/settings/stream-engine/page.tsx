"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Loader2, Trash2, Pause, Play, Shield } from "lucide-react";

interface StreamEngineConfig {
  logLevel?: string;
  readTimeout?: string;
  writeTimeout?: string;
  rtsp?: boolean;
  rtspAddress?: string;
  hls?: boolean;
  hlsSegmentDuration?: string;
  hlsPartDuration?: string;
  hlsSegmentCount?: number;
  rtmp?: boolean;
  srt?: boolean;
  webrtc?: boolean;
  [key: string]: unknown;
}

interface StreamEnginePath {
  name: string;
  ready: boolean;
  readyTime: string | null;
  tracks: string[];
  bytesReceived: number;
  bytesSent: number;
}

interface ConfigHistoryEntry {
  id: string;
  changedFields: string[];
  changedBy: string | null;
  changeReason: string | null;
  createdAt: string;
}

interface LogEntry {
  message: string;
  timestamp: string;
}

const LOG_LEVELS = ["debug", "info", "warn", "error"];

export default function StreamEngineSettingsPage() {
  const [_config, setConfig] = useState<StreamEngineConfig>({});
  const [configVersion, setConfigVersion] = useState(1);
  const [_paths, setPaths] = useState<StreamEnginePath[]>([]);
  const [_history, setHistory] = useState<ConfigHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Helpers: strip/add unit for StreamEngine config values
  function stripUnit(val: unknown, unit: string): string {
    const s = String(val ?? "");
    return s.replace(new RegExp(unit + "$", "i"), "");
  }

  // Settings form state (numbers stored WITHOUT units)
  const [readTimeout, setReadTimeout] = useState("10");
  const [writeTimeout, setWriteTimeout] = useState("10");
  const [rtspEnabled, setRtspEnabled] = useState(true);
  const [rtspAddress, setRtspAddress] = useState(":8554");
  const [hlsEnabled, setHlsEnabled] = useState(true);
  const [hlsSegmentDuration, setHlsSegmentDuration] = useState("2");
  const [hlsPartDuration, setHlsPartDuration] = useState("200");
  const [hlsSegmentCount, setHlsSegmentCount] = useState("5");
  const [hlsVariant, setHlsVariant] = useState("fmp4");
  const [hlsSegmentMaxSize, setHlsSegmentMaxSize] = useState("50");
  const [hlsAllowOrigins, setHlsAllowOrigins] = useState("*");
  const [rtmpEnabled, setRtmpEnabled] = useState(false);
  const [srtEnabled, setSrtEnabled] = useState(false);
  const [webrtcEnabled, setWebrtcEnabled] = useState(false);
  const [webrtcICEServers, setWebrtcICEServers] = useState("");
  const [webrtcHandshakeTimeout, setWebrtcHandshakeTimeout] = useState("10");
  const [rtspTransports, setRtspTransports] = useState<string[]>(["udp", "tcp"]);
  const [rtspEncryption, setRtspEncryption] = useState("no");
  const [writeQueueSize, setWriteQueueSize] = useState("512");
  const [udpMaxPayloadSize, setUdpMaxPayloadSize] = useState("1452");

  // Stream Security state
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState("300");
  const [cdnEnabled, setCdnEnabled] = useState(false);
  const [cdnOriginUrl, setCdnOriginUrl] = useState("");

  // Recording state
  const [recordingMode, setRecordingMode] = useState("continuous");
  const [retentionDays, setRetentionDays] = useState("30");
  const [autoPurge, setAutoPurge] = useState(true);
  const [storagePath, setStoragePath] = useState("/recordings");

  // Stream Log state
  const [logLevel, setLogLevel] = useState("info");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logPaused, setLogPaused] = useState(false);
  const [logConnected, setLogConnected] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  async function fetchConfig() {
    try {
      const res = await apiClient.get<{
        data: { config: StreamEngineConfig; version: number; updatedAt: string };
      }>("/mediamtx/config");
      const c = res.data.config;
      setConfig(c);
      setConfigVersion(res.data.version);

      if (c.logLevel) setLogLevel(c.logLevel);
      if (c.readTimeout) setReadTimeout(stripUnit(c.readTimeout, "s"));
      if (c.writeTimeout) setWriteTimeout(stripUnit(c.writeTimeout, "s"));
      if (c.rtsp !== undefined) setRtspEnabled(c.rtsp);
      if (c.rtspAddress) setRtspAddress(c.rtspAddress);
      if (c.hls !== undefined) setHlsEnabled(c.hls);
      if (c.hlsSegmentDuration) setHlsSegmentDuration(stripUnit(c.hlsSegmentDuration, "s"));
      if (c.hlsPartDuration) setHlsPartDuration(stripUnit(c.hlsPartDuration, "ms"));
      if (c.hlsSegmentCount !== undefined) setHlsSegmentCount(String(c.hlsSegmentCount));
      if (c.hlsVariant) setHlsVariant(c.hlsVariant as string);
      if (c.hlsSegmentMaxSize) setHlsSegmentMaxSize(stripUnit(c.hlsSegmentMaxSize, "M"));
      if (c.hlsAllowOrigins) setHlsAllowOrigins(Array.isArray(c.hlsAllowOrigins) ? (c.hlsAllowOrigins as string[]).join(", ") : String(c.hlsAllowOrigins));
      if (c.rtmp !== undefined) setRtmpEnabled(c.rtmp);
      if (c.srt !== undefined) setSrtEnabled(c.srt);
      if (c.webrtc !== undefined) setWebrtcEnabled(c.webrtc);
      if (c.webrtcICEServers2) setWebrtcICEServers(Array.isArray(c.webrtcICEServers2) ? (c.webrtcICEServers2 as { url: string }[]).map(s => s.url).join(", ") : "");
      if (c.webrtcHandshakeTimeout) setWebrtcHandshakeTimeout(stripUnit(c.webrtcHandshakeTimeout, "s"));
      if (c.rtspTransports) setRtspTransports(c.rtspTransports as string[]);
      if (c.rtspEncryption) setRtspEncryption(c.rtspEncryption as string);
      if (c.writeQueueSize !== undefined) setWriteQueueSize(String(c.writeQueueSize));
      if (c.udpMaxPayloadSize !== undefined) setUdpMaxPayloadSize(String(c.udpMaxPayloadSize));
      // Stream security
      if (c.streamSecurityEnabled !== undefined) setSecurityEnabled(c.streamSecurityEnabled as boolean);
      if (c.streamTokenExpiry !== undefined) setTokenExpiry(String(c.streamTokenExpiry));
      if (c.cdnEnabled !== undefined) setCdnEnabled(c.cdnEnabled as boolean);
      if (c.cdnOriginUrl) setCdnOriginUrl(c.cdnOriginUrl as string);
    } catch {
      toast.error("Failed to fetch stream engine config");
    }

    // Fetch recording config
    try {
      const recRes = await apiClient.get<{
        data: {
          recording_mode?: string;
          retention_days?: number;
          auto_purge?: boolean;
          storage_path?: string;
        };
      }>("/recording-config/global");
      const rc = recRes.data;
      if (rc.recording_mode) setRecordingMode(rc.recording_mode);
      if (rc.retention_days !== undefined) setRetentionDays(String(rc.retention_days));
      if (rc.auto_purge !== undefined) setAutoPurge(rc.auto_purge);
      if (rc.storage_path) setStoragePath(rc.storage_path);
    } catch {
      // Use defaults on error
    }
  }

  async function fetchHistory() {
    try {
      const res = await apiClient.get<{ data: ConfigHistoryEntry[] }>(
        "/mediamtx/config/history?limit=10",
      );
      setHistory(res.data);
    } catch {
      // History unavailable
    }
  }

  async function fetchPaths() {
    try {
      const res = await apiClient.get<{
        data: { items: StreamEnginePath[]; pageCount: number };
      }>("/mediamtx/paths");
      setPaths(res.data.items ?? []);
    } catch {
      // Paths unavailable
    }
  }

  useEffect(() => {
    Promise.all([fetchConfig(), fetchPaths(), fetchHistory()]).finally(() =>
      setLoading(false),
    );
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (!logPaused && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, logPaused]);

  // Connect to SSE log stream
  const connectLogs = useCallback(async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Get auth headers
      const headers = await (apiClient as any).getHeaders();
      const token = headers["Authorization"]?.replace("Bearer ", "");

      // EventSource doesn't support custom headers, use query param
      const es = new EventSource(
        `http://localhost:3001/api/v1/mediamtx/logs?token=${token ?? ""}`,
      );

      es.onopen = () => setLogConnected(true);
      es.onmessage = (event) => {
        if (logPaused) return;
        try {
          const entry = JSON.parse(event.data) as LogEntry;
          setLogs((prev) => [...prev.slice(-500), entry]); // Keep last 500 lines
        } catch {
          // Ignore parse errors
        }
      };
      es.onerror = () => {
        setLogConnected(false);
        es.close();
      };

      eventSourceRef.current = es;
    } catch {
      setLogConnected(false);
    }
  }, [logPaused]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Validate numeric fields
  const numericFields = [
    { name: "Read Timeout", value: readTimeout },
    { name: "Write Timeout", value: writeTimeout },
    { name: "HLS Segment Duration", value: hlsSegmentDuration },
    { name: "HLS Part Duration", value: hlsPartDuration },
    { name: "HLS Segment Count", value: hlsSegmentCount },
    { name: "HLS Max Segment Size", value: hlsSegmentMaxSize },
    { name: "Write Queue Size", value: writeQueueSize },
    { name: "UDP Max Payload Size", value: udpMaxPayloadSize },
    { name: "WebRTC Handshake Timeout", value: webrtcHandshakeTimeout },
    { name: "Token Expiry", value: tokenExpiry },
  ];

  function isValidPositiveNumber(val: string): boolean {
    const n = Number(val);
    return !isNaN(n) && n > 0 && String(n) === val.trim();
  }

  async function handleSave() {
    // Validate all numeric fields
    for (const field of numericFields) {
      if (!isValidPositiveNumber(field.value)) {
        toast.error(`Invalid value for ${field.name}`, {
          description: "Must be a positive number.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const res = await apiClient.patch<{
        data: { config: StreamEngineConfig; version: number; changed: boolean };
      }>("/mediamtx/config", {
        config: {
          logLevel,
          readTimeout: `${readTimeout}s`,
          writeTimeout: `${writeTimeout}s`,
          rtsp: rtspEnabled,
          rtspAddress,
          hls: hlsEnabled,
          hlsSegmentDuration: `${hlsSegmentDuration}s`,
          hlsPartDuration: `${hlsPartDuration}ms`,
          hlsSegmentCount: parseInt(hlsSegmentCount, 10),
          hlsVariant,
          hlsSegmentMaxSize: `${hlsSegmentMaxSize}M`,
          hlsAllowOrigins: hlsAllowOrigins.split(",").map(s => s.trim()).filter(Boolean),
          rtmp: rtmpEnabled,
          srt: srtEnabled,
          webrtc: webrtcEnabled,
          webrtcICEServers2: webrtcICEServers.trim() ? webrtcICEServers.split(",").map(s => ({ url: s.trim() })) : [],
          webrtcHandshakeTimeout: `${webrtcHandshakeTimeout}s`,
          rtspTransports,
          rtspEncryption,
          writeQueueSize: parseInt(writeQueueSize, 10),
          udpMaxPayloadSize: parseInt(udpMaxPayloadSize, 10),
          // Stream security
          streamSecurityEnabled: securityEnabled,
          streamTokenExpiry: parseInt(tokenExpiry, 10),
          cdnEnabled,
          cdnOriginUrl: cdnOriginUrl.trim() || undefined,
        },
        version: configVersion,
      });
      // Save recording config
      await apiClient.put("/recording-config/global", {
        recording_mode: recordingMode,
        retention_days: parseInt(retentionDays),
        auto_purge: autoPurge,
        storage_path: storagePath,
        storage_type: "local",
        format: "fmp4",
        resolution: "original",
      });

      if (res.data.changed) {
        setConfigVersion(res.data.version);
        toast.success("Configuration saved and applied to stream engine");
        fetchHistory();
      } else {
        toast.info("No changes detected");
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes("version")
          ? "Config was modified by another user. Please reload the page."
          : "Failed to update configuration";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function getLogColor(msg: string): string {
    if (msg.includes("ERR") || msg.includes("error")) return "text-red-400";
    if (msg.includes("WAR") || msg.includes("warn")) return "text-amber-400";
    if (msg.includes("INF") || msg.includes("info")) return "text-green-400";
    if (msg.includes("DBG") || msg.includes("debug")) return "text-zinc-500";
    return "text-zinc-300";
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Stream Engine
        </h1>
        <p className="text-muted-foreground">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Stream Engine
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the stream engine settings. Changes are saved and
          applied automatically without interrupting active streams.
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="logs">
            Stream Log
            {logConnected && (
              <span className="ml-1.5 size-1.5 rounded-full bg-emerald-500 inline-block" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ====== SETTINGS TAB ====== */}
        <TabsContent value="settings" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Save Changes
            </Button>
          </div>

          {/* RTSP */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">RTSP</CardTitle>
              <CardDescription>
                Real Time Streaming Protocol — used for camera ingest. Cameras
                push RTSP streams to the stream engine which repackages them to HLS.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable RTSP Server</Label>
                  <p className="text-xs text-muted-foreground">
                    Accept incoming RTSP connections from cameras
                  </p>
                </div>
                <Switch
                  checked={rtspEnabled}
                  onCheckedChange={setRtspEnabled}
                />
              </div>
              {rtspEnabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Listen Address</Label>
                    <Input
                      value={rtspAddress}
                      onChange={(e) => setRtspAddress(e.target.value)}
                      placeholder=":8554"
                    />
                    <p className="text-xs text-muted-foreground">
                      Port for cameras to connect to. Default :8554.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Encryption</Label>
                      <Select value={rtspEncryption} onValueChange={setRtspEncryption}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="optional">Optional</SelectItem>
                          <SelectItem value="strict">Strict (TLS only)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Require TLS for RTSP connections.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Transports</Label>
                      <div className="flex flex-col gap-2 pt-1">
                        {["udp", "tcp", "multicast"].map((t) => (
                          <label key={t} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={rtspTransports.includes(t)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setRtspTransports((prev) => [...prev, t]);
                                } else {
                                  setRtspTransports((prev) => prev.filter((x) => x !== t));
                                }
                              }}
                            />
                            {t.toUpperCase()}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* HLS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">HLS</CardTitle>
              <CardDescription>
                HTTP Live Streaming — the default delivery protocol for
                viewers. Streams are segmented and served over HTTP for broad
                device compatibility.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable HLS Server</Label>
                  <p className="text-xs text-muted-foreground">
                    Serve HLS playlists and segments to viewers
                  </p>
                </div>
                <Switch
                  checked={hlsEnabled}
                  onCheckedChange={setHlsEnabled}
                />
              </div>
              {hlsEnabled && (
                <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Segment Duration (seconds)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={hlsSegmentDuration}
                      onChange={(e) => setHlsSegmentDuration(e.target.value)}
                      placeholder="2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Length of each HLS segment. Shorter = lower latency.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Part Duration (ms)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={hlsPartDuration}
                      onChange={(e) => setHlsPartDuration(e.target.value)}
                      placeholder="200"
                    />
                    <p className="text-xs text-muted-foreground">
                      LL-HLS partial segment duration for low latency.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Segment Count</Label>
                    <Input
                      type="number"
                      value={hlsSegmentCount}
                      onChange={(e) => setHlsSegmentCount(e.target.value)}
                      placeholder="5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of segments in the sliding playlist window.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Variant</Label>
                    <Select value={hlsVariant} onValueChange={setHlsVariant}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fmp4">fMP4</SelectItem>
                        <SelectItem value="mpegts">MPEG-TS</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      fMP4 supports low-latency. MPEG-TS for legacy devices.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Segment Size (MB)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={hlsSegmentMaxSize}
                      onChange={(e) => setHlsSegmentMaxSize(e.target.value)}
                      placeholder="50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum size per segment. Increase for high bitrate streams.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Allow Origins (CORS)</Label>
                    <Input
                      value={hlsAllowOrigins}
                      onChange={(e) => setHlsAllowOrigins(e.target.value)}
                      placeholder="*"
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated origins. Use * to allow all.
                    </p>
                  </div>
                </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeouts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeouts</CardTitle>
              <CardDescription>
                Connection timeout settings. If a camera or viewer doesn't
                send/receive data within this period, the connection is dropped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Read Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={readTimeout}
                    onChange={(e) => setReadTimeout(e.target.value)}
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Max time to wait for data from a camera. Increase if cameras
                    are on unreliable networks.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Write Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={writeTimeout}
                    onChange={(e) => setWriteTimeout(e.target.value)}
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Max time to wait for a viewer to receive data. Increase for
                    slow client connections.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance</CardTitle>
              <CardDescription>
                Buffer and packet size settings. Change only if you understand
                the impact on stream quality and latency.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Write Queue Size</Label>
                  <Input
                    type="number"
                    value={writeQueueSize}
                    onChange={(e) => setWriteQueueSize(e.target.value)}
                    placeholder="512"
                  />
                  <p className="text-xs text-muted-foreground">
                    Buffer size per connection. Increase for high-bitrate streams
                    or slow viewers.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>UDP Max Payload Size</Label>
                  <Input
                    type="number"
                    value={udpMaxPayloadSize}
                    onChange={(e) => setUdpMaxPayloadSize(e.target.value)}
                    placeholder="1452"
                  />
                  <p className="text-xs text-muted-foreground">
                    MTU size for UDP packets. Default 1452 works for most networks.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Protocols */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Additional Protocols
              </CardTitle>
              <CardDescription>
                Enable optional streaming protocols. RTSP and HLS are the
                primary protocols. These are supplementary.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>RTMP</Label>
                  <p className="text-xs text-muted-foreground">
                    Real-Time Messaging Protocol — for OBS Studio and legacy
                    systems
                  </p>
                </div>
                <Switch
                  checked={rtmpEnabled}
                  onCheckedChange={setRtmpEnabled}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>SRT</Label>
                  <p className="text-xs text-muted-foreground">
                    Secure Reliable Transport — for streaming over unreliable
                    networks with error correction
                  </p>
                </div>
                <Switch
                  checked={srtEnabled}
                  onCheckedChange={setSrtEnabled}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>WebRTC</Label>
                  <p className="text-xs text-muted-foreground">
                    Web Real-Time Communication — ultra-low latency (&lt;1s)
                    for browser-based viewing
                  </p>
                </div>
                <Switch
                  checked={webrtcEnabled}
                  onCheckedChange={setWebrtcEnabled}
                />
              </div>
              {webrtcEnabled && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ICE Servers (STUN/TURN)</Label>
                      <Input
                        value={webrtcICEServers}
                        onChange={(e) => setWebrtcICEServers(e.target.value)}
                        placeholder="stun:stun.l.google.com:19302"
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated STUN/TURN URLs for NAT traversal.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Handshake Timeout (seconds)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={webrtcHandshakeTimeout}
                        onChange={(e) => setWebrtcHandshakeTimeout(e.target.value)}
                        placeholder="10"
                      />
                      <p className="text-xs text-muted-foreground">
                        Max time to establish a WebRTC connection.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Stream Security */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="size-4" />
                Stream Security
              </CardTitle>
              <CardDescription>
                Protect HLS streams with signed tokens. When enabled, viewers
                must have a valid token to access streams. Direct stream URLs
                will no longer work without authentication.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Signed URL Protection</Label>
                  <p className="text-xs text-muted-foreground">
                    Require token to access HLS streams
                  </p>
                </div>
                <Switch
                  checked={securityEnabled}
                  onCheckedChange={setSecurityEnabled}
                />
              </div>

              {securityEnabled && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-2">
                    <Label>Token Expiry (seconds)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={tokenExpiry}
                      onChange={(e) => setTokenExpiry(e.target.value)}
                      placeholder="300"
                    />
                    <p className="text-xs text-muted-foreground">
                      How long each signed URL is valid. Default 300 (5 minutes).
                    </p>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>CDN Mode</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable CDN-compatible cache headers for HLS segments
                      </p>
                    </div>
                    <Switch
                      checked={cdnEnabled}
                      onCheckedChange={setCdnEnabled}
                    />
                  </div>

                  {cdnEnabled && (
                    <div className="space-y-2">
                      <Label>CDN Origin URL</Label>
                      <Input
                        value={cdnOriginUrl}
                        onChange={(e) => setCdnOriginUrl(e.target.value)}
                        placeholder="https://cdn.example.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Base URL for CDN. Playback URLs will use this instead of
                        the API server URL. Leave empty for direct proxy.
                      </p>
                    </div>
                  )}

                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      Domain restrictions can be configured per camera or project
                      in{" "}
                      <a href="/policies" className="underline hover:text-foreground">
                        Policies
                      </a>
                      .
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Recording */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recording</CardTitle>
              <CardDescription>
                Configure how cameras record and store footage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="se-recording-mode">Recording Mode</Label>
                <Select
                  value={recordingMode}
                  onValueChange={setRecordingMode}
                >
                  <SelectTrigger id="se-recording-mode" className="w-full sm:w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="continuous">
                      <div>
                        <span className="font-medium">Continuous</span>
                        <span className="text-muted-foreground ml-2">— Record 24/7</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="scheduled">
                      <div>
                        <span className="font-medium">Scheduled</span>
                        <span className="text-muted-foreground ml-2">— Time windows only</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="event_based">
                      <div>
                        <span className="font-medium">Event Based</span>
                        <span className="text-muted-foreground ml-2">— On motion/trigger</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {recordingMode === "continuous" && "Cameras will record continuously around the clock. Best for high-security areas."}
                  {recordingMode === "scheduled" && "Cameras will only record during configured time windows. Saves storage."}
                  {recordingMode === "event_based" && "Cameras will start recording when triggered by events like motion detection."}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="se-retention-days">Retention Period</Label>
                <Select
                  value={retentionDays}
                  onValueChange={setRetentionDays}
                >
                  <SelectTrigger id="se-retention-days" className="w-full sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Recordings older than this will be deleted. Limited by plan tier.
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="se-auto-purge">Auto-purge</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically delete recordings and files when they exceed the retention period.
                  </p>
                </div>
                <Switch
                  id="se-auto-purge"
                  checked={autoPurge}
                  onCheckedChange={setAutoPurge}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="se-storage-path">Storage Path</Label>
                <Input
                  id="se-storage-path"
                  value={storagePath}
                  onChange={(e) => setStoragePath(e.target.value)}
                  placeholder="/recordings"
                />
                <p className="text-xs text-muted-foreground">
                  Directory path for recording files. Use NAS mount path (e.g. /mnt/nas/recordings) for network storage.
                </p>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ====== STREAM LOG TAB ====== */}
        <TabsContent value="logs" className="space-y-4">
          {/* Log Level + Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log Configuration</CardTitle>
              <CardDescription>
                Set the log verbosity level. &quot;debug&quot; shows everything
                including packet details, &quot;error&quot; shows only failures.
                Changes apply immediately via hot-reload.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="space-y-2 w-48">
                  <Label>Log Level</Label>
                  <Select value={logLevel} onValueChange={setLogLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOG_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2 rounded-full ${
                                l === "error"
                                  ? "bg-red-500"
                                  : l === "warn"
                                    ? "bg-amber-500"
                                    : l === "debug"
                                      ? "bg-gray-400"
                                      : "bg-blue-500"
                              }`}
                            />
                            {l}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await apiClient.patch("/mediamtx/config", {
                        config: { logLevel },
                        version: configVersion,
                      });
                      toast.success(`Log level changed to "${logLevel}"`);
                    } catch {
                      toast.error("Failed to update log level");
                    }
                  }}
                >
                  <Save className="mr-1 size-3" />
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Live Log Viewer */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Live Logs</CardTitle>
                  <CardDescription>
                    Real-time stream engine logs.
                    {logConnected && (
                      <Badge
                        variant="secondary"
                        className="ml-2 bg-emerald-100 text-emerald-700"
                      >
                        Connected
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogPaused(!logPaused)}
                  >
                    {logPaused ? (
                      <>
                        <Play className="mr-1 size-3" /> Resume
                      </>
                    ) : (
                      <>
                        <Pause className="mr-1 size-3" /> Pause
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogs([])}
                  >
                    <Trash2 className="mr-1 size-3" /> Clear
                  </Button>
                  {!logConnected ? (
                    <Button size="sm" onClick={connectLogs}>
                      Connect
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        eventSourceRef.current?.close();
                        setLogConnected(false);
                      }}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] rounded-md border bg-zinc-950 p-4">
                <div className="font-mono text-xs space-y-0.5">
                  {logs.length === 0 ? (
                    <p className="text-zinc-500">
                      {logConnected
                        ? "Waiting for log entries..."
                        : 'Click "Connect" to start streaming logs.'}
                    </p>
                  ) : (
                    logs.map((entry, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-zinc-600 shrink-0 select-none">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={getLogColor(entry.message)}>
                          {entry.message}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
              {logPaused && (
                <p className="mt-2 text-xs text-amber-500 text-center">
                  Log streaming paused — new entries are being buffered.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
