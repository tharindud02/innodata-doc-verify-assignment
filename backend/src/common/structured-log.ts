export type StructuredLogValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type StructuredLogContext = Record<string, StructuredLogValue>;

export function structuredLog(
  event: string,
  context: StructuredLogContext = {},
): string {
  return JSON.stringify({
    event,
    ts: new Date().toISOString(),
    ...context,
  });
}
