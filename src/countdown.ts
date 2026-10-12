// Shared by the extension (status bar) and the webviews (button, break screen).

/** Formats the time left until `endsAt` as m:ss, never below 0:00. */
export function formatCountdown(endsAt: number, now: number): string {
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
