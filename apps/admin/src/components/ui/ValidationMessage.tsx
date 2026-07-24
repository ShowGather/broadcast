interface ValidationMessageProps {
  /** Message text */
  message: string;
  /** Validation type */
  type?: "error" | "success" | "warning" | "info";
}

/**
 * Consistent validation/status message display.
 * Uses colour plus icon/text for all states. Does not rely on colour alone.
 */
export function ValidationMessage({ message, type = "info" }: ValidationMessageProps) {
  const icon = type === "error" ? "✗" : type === "success" ? "✓" : type === "warning" ? "!" : "i";

  return (
    <div className={`validation-message validation-message--${type}`} role={type === "error" ? "alert" : "status"}>
      <span className="validation-message__icon" aria-hidden="true">{icon}</span>
      <span className="validation-message__text">{message}</span>
    </div>
  );
}
