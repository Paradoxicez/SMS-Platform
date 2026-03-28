/**
 * Convert camelCase keys to snake_case recursively.
 * Drizzle ORM returns camelCase by default, but our API convention is snake_case.
 */
export function toSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      result[snakeKey] = toSnakeCase(value);
    }
    return result;
  }
  return obj;
}
