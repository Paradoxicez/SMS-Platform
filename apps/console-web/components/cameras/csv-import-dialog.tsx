"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { apiClient, type StreamProfile } from "../../lib/api-client";
import type { CsvParseResult, CsvRow } from "../../lib/csv-parser";
import type { Camera } from "@repo/types";

interface EditableRow extends CsvRow {
  __selected: string;
  __status: "valid" | "warning" | "error";
  __statusMessage: string;
  __profileId: string;
  __matchedCameraId: string;
}

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  parseResult: CsvParseResult | null;
  onImport: (data: {
    mode: "add-cameras" | "assign-profiles";
    rows: EditableRow[];
  }) => void;
  existingCameras?: Camera[];
  preselectedProfileId?: string;
}

function getRowStatus(
  row: CsvRow,
  mode: "add-cameras" | "assign-profiles",
  existingCameras: Camera[],
): { status: "valid" | "warning" | "error"; message: string; matchedCameraId: string } {
  if (mode === "add-cameras") {
    const name = row["name"] ?? "";
    const rtspUrl = row["rtsp_url"] ?? "";
    if (!name && !rtspUrl) {
      return { status: "error", message: "Missing name and rtsp_url", matchedCameraId: "" };
    }
    if (!name) {
      return { status: "error", message: "Missing name", matchedCameraId: "" };
    }
    if (!rtspUrl) {
      return { status: "warning", message: "Missing rtsp_url", matchedCameraId: "" };
    }
    return { status: "valid", message: "OK", matchedCameraId: "" };
  }

  // assign-profiles mode
  const cameraName = row["camera_name"] ?? row["name"] ?? "";
  if (!cameraName) {
    return { status: "error", message: "Missing camera name", matchedCameraId: "" };
  }

  const matched = existingCameras.find(
    (c) => c.name.toLowerCase() === cameraName.toLowerCase(),
  );
  if (!matched) {
    return { status: "warning", message: "Camera not found", matchedCameraId: "" };
  }

  return { status: "valid", message: "Matched", matchedCameraId: matched.id };
}

export function CsvImportDialog({
  open,
  onClose,
  parseResult,
  onImport,
  existingCameras = [],
  preselectedProfileId,
}: CsvImportDialogProps) {
  const [profiles, setProfiles] = useState<StreamProfile[]>([]);
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [applyAllProfileId, setApplyAllProfileId] = useState<string>("");

  useEffect(() => {
    if (open) {
      apiClient
        .listProfiles()
        .then((res) => setProfiles(res.data ?? []))
        .catch(() => setProfiles([]));
    }
  }, [open]);

  // Initialize editable rows when parseResult changes
  useEffect(() => {
    if (!parseResult || !open) {
      setEditableRows([]);
      return;
    }

    const rows: EditableRow[] = parseResult.rows.map((row) => {
      const { status, message, matchedCameraId } = getRowStatus(
        row,
        parseResult.mode,
        existingCameras,
      );
      return {
        ...row,
        __selected: status !== "error" ? "true" : "false",
        __status: status,
        __statusMessage: message,
        __profileId: preselectedProfileId ?? row["profile_id"] ?? "",
        __matchedCameraId: matchedCameraId,
      };
    });

    setEditableRows(rows);
    setApplyAllProfileId(preselectedProfileId ?? "");
  }, [parseResult, open, existingCameras, preselectedProfileId]);

  const handleCellEdit = (rowIndex: number, key: string, value: string) => {
    setEditableRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex]! };
      row[key] = value;

      // Re-validate
      if (parseResult) {
        const { status, message, matchedCameraId } = getRowStatus(
          row,
          parseResult.mode,
          existingCameras,
        );
        row.__status = status;
        row.__statusMessage = message;
        row.__matchedCameraId = matchedCameraId;
      }

      updated[rowIndex] = row;
      return updated;
    });
  };

  const handleProfileChange = (rowIndex: number, profileId: string) => {
    setEditableRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex]!, __profileId: profileId };
      return updated;
    });
  };

  const handleToggleRow = (rowIndex: number) => {
    setEditableRows((prev) => {
      const updated = [...prev];
      const row = updated[rowIndex]!;
      updated[rowIndex] = {
        ...row,
        __selected: row.__selected === "true" ? "false" : "true",
      };
      return updated;
    });
  };

  const handleApplyAllProfile = (profileId: string) => {
    setApplyAllProfileId(profileId);
    setEditableRows((prev) =>
      prev.map((row) => ({ ...row, __profileId: profileId })),
    );
  };

  const validCount = useMemo(
    () =>
      editableRows.filter(
        (r) => r.__selected === "true" && r.__status !== "error",
      ).length,
    [editableRows],
  );

  const warningCount = useMemo(
    () => editableRows.filter((r) => r.__status === "warning").length,
    [editableRows],
  );

  const errorCount = useMemo(
    () => editableRows.filter((r) => r.__status === "error").length,
    [editableRows],
  );

  if (!parseResult) return null;

  const mode = parseResult.mode;
  const { detectedColumns } = parseResult;

  // Determine visible columns for the table
  const displayHeaders =
    mode === "add-cameras"
      ? ["name", "rtsp_url", "site", "site_id"]
          .filter((h) => parseResult.headers.includes(h))
          .concat(["profile"])
      : ["camera_name", "name"]
          .filter((h) => parseResult.headers.includes(h))
          .concat(["match_status", "profile"]);

  // Deduplicate
  const uniqueHeaders = [...new Set(displayHeaders)];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === "add-cameras" ? "Import Cameras" : "Assign Profiles from CSV"}
          </DialogTitle>
          <DialogDescription>
            Detected {editableRows.length} row{editableRows.length !== 1 ? "s" : ""},{" "}
            mode: {mode === "add-cameras" ? "Add Cameras" : "Assign Profiles"}
          </DialogDescription>
        </DialogHeader>

        {/* Detected columns summary */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={detectedColumns.hasName ? "text-green-600" : "text-muted-foreground"}>
            {detectedColumns.hasName ? "\u2713" : "\u2717"} name
          </span>
          <span className={detectedColumns.hasRtspUrl ? "text-green-600" : "text-muted-foreground"}>
            {detectedColumns.hasRtspUrl ? "\u2713" : "\u2717"} rtsp_url
          </span>
          <span className={detectedColumns.hasSite ? "text-green-600" : "text-muted-foreground"}>
            {detectedColumns.hasSite ? "\u2713" : "\u2717"} site
          </span>
          <span className={detectedColumns.hasProfile ? "text-green-600" : "text-muted-foreground"}>
            {detectedColumns.hasProfile ? "\u2713" : "\u2717"} profile
          </span>
        </div>

        {/* Apply to all profile */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium whitespace-nowrap">Apply to all:</span>
          <Select value={applyAllProfileId} onValueChange={handleApplyAllProfile}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.is_default ? " (Default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data table */}
        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={editableRows.every((r) => r.__selected === "true")}
                    onCheckedChange={(checked) => {
                      setEditableRows((prev) =>
                        prev.map((r) => ({
                          ...r,
                          __selected: checked ? "true" : "false",
                        })),
                      );
                    }}
                  />
                </TableHead>
                <TableHead className="w-10">Status</TableHead>
                {uniqueHeaders.map((h) => (
                  <TableHead key={h} className="capitalize">
                    {h.replace(/_/g, " ")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {editableRows.map((row, idx) => (
                <TableRow key={idx} className={row.__status === "error" ? "bg-red-50/50" : row.__status === "warning" ? "bg-yellow-50/50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={row.__selected === "true"}
                      onCheckedChange={() => handleToggleRow(idx)}
                    />
                  </TableCell>
                  <TableCell>
                    {row.__status === "valid" && (
                      <CheckCircle2 className="size-4 text-green-600" />
                    )}
                    {row.__status === "warning" && (
                      <AlertTriangle className="size-4 text-yellow-600" />
                    )}
                    {row.__status === "error" && (
                      <XCircle className="size-4 text-red-600" />
                    )}
                  </TableCell>
                  {uniqueHeaders.map((h) => {
                    if (h === "profile") {
                      return (
                        <TableCell key={h}>
                          <Select
                            value={row.__profileId}
                            onValueChange={(v) => handleProfileChange(idx, v)}
                          >
                            <SelectTrigger className="h-8 w-[160px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {profiles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      );
                    }

                    if (h === "match_status") {
                      return (
                        <TableCell key={h}>
                          {row.__matchedCameraId ? (
                            <Badge className="bg-green-100 text-green-700">
                              Matched
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not Found</Badge>
                          )}
                        </TableCell>
                      );
                    }

                    const cellValue = row[h] ?? "";
                    return (
                      <TableCell key={h}>
                        <Input
                          className="h-8 text-xs"
                          value={cellValue}
                          onChange={(e) =>
                            handleCellEdit(idx, h, e.target.value)
                          }
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600">Valid: {validCount}</span>
          {warningCount > 0 && (
            <span className="text-yellow-600">Warnings: {warningCount}</span>
          )}
          {errorCount > 0 && (
            <span className="text-red-600">Errors: {errorCount}</span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onImport({
                mode,
                rows: editableRows.filter(
                  (r) => r.__selected === "true" && r.__status !== "error",
                ),
              })
            }
            disabled={validCount === 0}
          >
            Import {validCount}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
