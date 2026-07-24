"use client";

export function ValidationMessage({ message, type = "info" }: { message: string; type?: "error" | "success" | "warning" | "info" }) {
  const icon = type === "error" ? "\u2717" : type === "success" ? "\u2713" : type === "warning" ? "!" : "i";
  return (
    <div className={`validation-message validation-message--${type}`} role={type === "error" ? "alert" : "status"}>
      <span className="validation-message__icon" aria-hidden="true">{icon}</span>
      <span className="validation-message__text">{message}</span>
    </div>
  );
}
