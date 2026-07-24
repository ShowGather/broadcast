"use client";

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const normalizedStatus = status.toLowerCase();
  const displayLabel = label ?? status;
  const icon = normalizedStatus === "live" || normalizedStatus === "active" ? "\u25CF"
    : normalizedStatus === "rehearsal" ? "\u25C9"
    : normalizedStatus === "complete" || normalizedStatus === "dispatched" ? "\u2713"
    : normalizedStatus === "failed" ? "\u2717"
    : normalizedStatus === "cancelled" ? "\u2298"
    : normalizedStatus === "pending" ? "\u25CB" : "\u25CB";
  return (
    <span className={`status-badge status-badge--${normalizedStatus}`}>
      <span className="status-badge__icon" aria-hidden="true">{icon}</span>
      <span className="status-badge__label">{displayLabel}</span>
    </span>
  );
}
