// Pure helpers for turning diagnostics into Mimir lines. No vscode imports so
// it can be unit tested.

export interface ErrorInfo {
  /** 1-based line number, as shown in the editor gutter. */
  line: number;
  message: string;
}

const MAX_MESSAGE_LENGTH = 140;

/** First line of a diagnostic message, trimmed to fit in the bubble. */
export function cleanMessage(message: string): string {
  const first = message.split(/\r?\n/)[0].trim();
  return first.length > MAX_MESSAGE_LENGTH
    ? `${first.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
    : first;
}

/**
 * Errors in `next` that weren't in `prev`. Matched by message rather than
 * line, so editing above an existing error doesn't make it look new.
 */
export function newErrors(prev: ErrorInfo[], next: ErrorInfo[]): ErrorInfo[] {
  const seen = new Map<string, number>();
  for (const error of prev) {
    seen.set(error.message, (seen.get(error.message) ?? 0) + 1);
  }
  return next.filter((error) => {
    const count = seen.get(error.message) ?? 0;
    if (count > 0) {
      seen.set(error.message, count - 1);
      return false;
    }
    return true;
  });
}

export function describeError(error: ErrorInfo, total: number): string {
  const suffix = total > 1 ? ` (${total} errors in this file)` : "";
  return `Line ${error.line}: ${cleanMessage(error.message)}${suffix}`;
}

export function summarizeErrors(errors: ErrorInfo[]): string {
  const [first] = errors;
  const count =
    errors.length === 1 ? "This file has an error." : `This file has ${errors.length} errors.`;
  return `${count} Line ${first.line}: ${cleanMessage(first.message)}`;
}
