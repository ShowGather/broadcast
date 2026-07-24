import { type ReactNode } from "react";

interface EmptyStateProps {
  /** Heading text */
  heading: string;
  /** Description text */
  description?: string;
  /** Optional action button */
  action?: ReactNode;
}

/**
 * Consistent empty state display.
 * Used when a list or section has no items to show.
 */
export function EmptyState({ heading, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3 className="empty-state__heading">{heading}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
