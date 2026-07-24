interface StatusBadgeProps {
  /** Status value */
  status: "draft" | "rehearsal" | "live" | "complete" | "archived" | "pending" | "active" | "failed" | "cancelled" | string;
  /** Optional label override */
  label?: string;
}

/**
 * Consistent status badge with color coding.
 * Uses colour plus icon/text for all states. Does not rely on colour alone.
 */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const displayLabel = label ?? status;

  const icon = normalizedStatus === "live" || normalizedStatus === "active" ? "●"
    : normalizedStatus === "rehearsal" ? "◉"
    : normalizedStatus === "complete" || normalizedStatus === "dispatched" ? "✓"
    : normalizedStatus === "failed" ? "✗"
    : normalizedStatus === "cancelled" ? "⊘"
    : normalizedStatus === "pending" ? "○"
    : "○";

  return (
    <span className={`status-badge status-badge--${normalizedStatus}`}>
      <span className="status-badge__icon" aria-hidden="true">{icon}</span>
      <span className="status-badge__label">{displayLabel}</span>
    </span>
  );
}
