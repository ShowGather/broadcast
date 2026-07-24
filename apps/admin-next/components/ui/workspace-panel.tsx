"use client";

import { type ReactNode } from "react";

interface WorkspacePanelProps {
  heading?: string;
  hint?: string;
  children: ReactNode;
  variant?: "default" | "readiness" | "preview" | "control" | "rehearse" | "run";
  className?: string;
  ariaLabel?: string;
}

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
