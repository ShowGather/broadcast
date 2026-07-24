interface ConnectionBadgeProps {
  /** Service name */
  service: string;
  /** Connection state */
  state: "checking" | "connected" | "offline";
}

/**
 * Consistent connection status indicator.
 * Uses colour plus text. Does not rely on colour alone.
 */
export function ConnectionBadge({ service, state }: ConnectionBadgeProps) {
  const icon = state === "connected" ? "●" : state === "checking" ? "◐" : "○";

  return (
    <span className={`connection-badge connection-badge--${state}`} role="status">
      <span className="connection-badge__icon" aria-hidden="true">{icon}</span>
      <span className="connection-badge__label">{service} {state}</span>
    </span>
  );
}
