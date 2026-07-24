"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
}

export function PrimaryAction({ children, icon, className = "", ...props }: ActionButtonProps) {
  return (
    <button type="button" className={`action-btn action-btn--primary ${className}`} {...props}>
      {icon && <span className="action-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="action-btn__label">{children}</span>
    </button>
  );
}

export function SecondaryAction({ children, icon, className = "", ...props }: ActionButtonProps) {
  return (
    <button type="button" className={`action-btn action-btn--secondary ${className}`} {...props}>
      {icon && <span className="action-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="action-btn__label">{children}</span>
    </button>
  );
}

export function DangerAction({ children, icon, className = "", ...props }: ActionButtonProps) {
  return (
    <button type="button" className={`action-btn action-btn--danger ${className}`} {...props}>
      {icon && <span className="action-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="action-btn__label">{children}</span>
    </button>
  );
}

export function SafetyAction({ children, icon, className = "", ...props }: ActionButtonProps) {
  return (
    <button type="button" className={`action-btn action-btn--safety ${className}`} {...props}>
      {icon && <span className="action-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="action-btn__label">{children}</span>
    </button>
  );
}
