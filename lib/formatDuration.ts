/**
 * Format a millisecond duration into a human-readable string.
 *   < 1 minute  → "< 1 minute"
 *   < 1 hour    → "X minutes"     e.g. "36 minutes"
 *   < 24 hours  → "Xh Ym"         e.g. "5h 30m"
 *   ≥ 24 hours  → "Xd Yh"         e.g. "3d 14h"
 */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1)  return "< 1 minute";
  if (totalMinutes < 60) return `${totalMinutes} ${totalMinutes === 1 ? "minute" : "minutes"}`;
  const days  = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins  = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format hours (as returned by API stats) into a human-readable string.
 * Returns "N/A" for null.
 */
export function formatHours(hours: number | null): string {
  if (hours === null) return "N/A";
  return formatDuration(Math.round(hours * 3_600_000));
}
