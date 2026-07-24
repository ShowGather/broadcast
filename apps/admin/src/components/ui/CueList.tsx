import { type ReactNode } from "react";

interface CueListItemProps {
  /** Cue order number */
  order: number;
  /** Cue label */
  label: string;
  /** Cue status */
  status: string;
  /** Whether cue is enabled */
  enabled: boolean;
  /** Whether this item is currently selected/active */
  active?: boolean;
  /** Action buttons to render for this cue */
  actions?: ReactNode;
  /** Click handler for selecting this cue */
  onSelect?: () => void;
  /** Whether the item is disabled (non-interactive) */
  disabled?: boolean;
}

/**
 * Consistent cue list item used across Prepare, Rehearse, and Run.
 * Each workspace layers its own specific actions on top.
 */
export function CueListItem({ order, label, status, enabled, active = false, actions, onSelect, disabled }: CueListItemProps) {
  return (
    <div className={`cue-list-item ${active ? "cue-list-item--active" : ""} ${!enabled ? "cue-list-item--disabled" : ""}`}>
      <button
        type="button"
        className="cue-list-item__select"
        onClick={onSelect}
        disabled={disabled}
        aria-current={active ? "true" : undefined}
      >
        <span className="cue-list-item__order">{order}.</span>
        <span className="cue-list-item__label">{label}</span>
        <span className={`cue-list-item__status cue-list-item__status--${status}`}>{status}</span>
      </button>
      {actions && <div className="cue-list-item__actions">{actions}</div>}
    </div>
  );
}

interface CueListProps {
  children: ReactNode;
  /** Optional heading */
  heading?: string;
  /** Optional aria-label */
  ariaLabel?: string;
}

/**
 * Consistent cue list container.
 */
export function CueList({ children, heading, ariaLabel }: CueListProps) {
  return (
    <div className="cue-list" role="list" aria-label={ariaLabel ?? "Cue list"}>
      {heading && <h3 className="cue-list__heading">{heading}</h3>}
      <div className="cue-list__items">{children}</div>
    </div>
  );
}
