"use client";

import { type ReactNode } from "react";

export function EmptyState({ heading, description, action }: { heading: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3 className="empty-state__heading">{heading}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
