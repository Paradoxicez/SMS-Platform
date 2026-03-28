export interface CsvRow {
  [key: string]: string;
}

export interface CsvParseResult {
  headers: string[];
  rows: CsvRow[];
  mode: "add-cameras" | "assign-profiles";
  detectedColumns: {
    hasName: boolean;
    hasRtspUrl: boolean;
    hasSite: boolean;
    hasProfile: boolean;
    hasCameraName: boolean;
  };
}

/**
 * Parse a single CSV line handling quoted values.
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Parse CSV text into structured data with auto-detected mode.
 *
 * Auto-detect mode:
 *   - if has 'rtsp_url' column -> "add-cameras"
 *   - else -> "assign-profiles"
 */
export function parseCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      mode: "assign-profiles",
      detectedColumns: {
        hasName: false,
        hasRtspUrl: false,
        hasSite: false,
        hasProfile: false,
        hasCameraName: false,
      },
    };
  }

  const headers = parseCsvLine(lines[0]!).map((h) => h.toLowerCase().replace(/\s+/g, "_"));

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!);
    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? "";
    }
    rows.push(row);
  }

  const headerSet = new Set(headers);

  const detectedColumns = {
    hasName: headerSet.has("name"),
    hasRtspUrl: headerSet.has("rtsp_url"),
    hasSite: headerSet.has("site") || headerSet.has("site_id"),
    hasProfile: headerSet.has("profile") || headerSet.has("profile_name") || headerSet.has("profile_id"),
    hasCameraName: headerSet.has("camera_name") || headerSet.has("name"),
  };

  const mode: "add-cameras" | "assign-profiles" = detectedColumns.hasRtspUrl
    ? "add-cameras"
    : "assign-profiles";

  return {
    headers,
    rows,
    mode,
    detectedColumns,
  };
}
