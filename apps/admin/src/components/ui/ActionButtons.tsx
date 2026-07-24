import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Optional icon element */
  icon?: ReactNode;
}

/**
 * Primary action button (e.g., Save in Prepare, GO in Run).
 * Visually dominant action in each workspace.
 */
export function PrimaryAction({ children, icon, className = "", ...props }: ActionButtonProps) {
  return (
    <button type="button" className={`action-btn action-btn--primary ${className}`} {...props}>
      {icon && <span className="action-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="action-btn__label">{children}</span>
    </button>
  );
}

/**
 * Secondary action button (e.g., Duplicate, Cancel).
 * Supporting actions that are not the primary workflow.
 */
export function SecondaryAction({ children, icon, className = "", ...props }: ActionButtonProps) {
  return (
    <button type="button" className={`action-btn action-btn--secondary ${className}`} {...props}>
      {icon && <span className="action-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="action-btn__label">{children}</span>
    </button>
  );
}

/**
 * Danger action button (e.g., Abandon, Delete).
 * Destructive actions that require confirmation.
 */
export function DangerAction({ children, icon, className = "", ...props }: ActionButtonProps) {
  return (
    <button type="button" className={`action-btn action-btn--danger ${className}`} {...props}>
      {icon && <span className="action-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="action-btn__label">{children}</span>
    </button>
  );
}

/**
 * Safety action button (e.g., Safe Clear).
 * Visually distinct from both GO and destructive session actions.
 */
export function SafetyAction({ children, icon, className = "", ...props }: ActionButtonProps) {
  return (
    <button type="button" className={`action-btn action-btn--safety ${className}`} {...props}>
      {icon && <span className="action-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="action-btn__label">{children}</span>
    </button>
  );
}
