"use client";

import { useRef, useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvDropZoneProps {
  onFileSelected: (file: File) => void;
}

export function CsvDropZone({ onFileSelected }: CsvDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0]!;
        if (file.name.endsWith(".csv") || file.type === "text/csv") {
          onFileSelected(file);
        }
      }
    },
    [onFileSelected],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelected(files[0]!);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [onFileSelected],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Upload className="size-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">
        Drag and drop a CSV file here
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        or click Browse to select a file
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => inputRef.current?.click()}
      >
        Browse
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
