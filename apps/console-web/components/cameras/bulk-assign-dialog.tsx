"use client";

import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { apiClient, type StreamProfile } from "../../lib/api-client";

interface BulkAssignDialogProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onAssign: (profileId: string) => void;
}

export function BulkAssignDialog({
  open,
  onClose,
  selectedCount,
  onAssign,
}: BulkAssignDialogProps) {
  const [profiles, setProfiles] = useState<StreamProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      apiClient
        .listProfiles()
        .then((res) => setProfiles(res.data ?? []))
        .catch(() => setProfiles([]));
      setSelectedProfileId("");
    }
  }, [open]);

  const handleAssign = () => {
    if (!selectedProfileId) return;
    setLoading(true);
    onAssign(selectedProfileId);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Profile</DialogTitle>
          <DialogDescription>
            Assign a stream profile to {selectedCount} selected camera
            {selectedCount !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Stream Profile</label>
            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.is_default ? " (Default)" : ""}
                  </SelectItem>
                ))}
                {profiles.length === 0 && (
                  <SelectItem value="__none" disabled>
                    No profiles available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedProfileId || loading}>
            {loading ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
