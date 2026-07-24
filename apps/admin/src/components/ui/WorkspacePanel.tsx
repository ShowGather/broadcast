import { type ReactNode } from "react";

interface WorkspacePanelProps {
  heading?: string;
  hint?: string;
  children: ReactNode;
  /** Panel visual variant */
  variant?: "default" | "readiness" | "preview" | "control" | "rehearse" | "run";
  /** Optional className for additional styling */
  className?: string;
  /** Optional aria-label for accessibility */
  ariaLabel?: string;
}

/**
 * Consistent panel container for workspace columns.
 * Provides standard padding, border, background, and heading structure.
 */
export function WorkspacePanel({ heading, hint, children, variant = "default", className = "", ariaLabel }: WorkspacePanelProps) {
  return (
    <section className={`workspace-panel workspace-panel--${variant} ${className}`} aria-label={ariaLabel}>
      {(heading || hint) && (
        <div className="workspace-panel__header">
          {heading && <h2 className="workspace-panel__heading">{heading}</h2>}
          {hint && <p className="workspace-panel__hint">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
