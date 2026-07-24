"use client";

import { type ReactNode } from "react";

interface CueListItemProps {
  order: number;
  label: string;
  status: string;
  enabled: boolean;
  active?: boolean;
  actions?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}

export function CueListItem({ order, label, status, enabled, active = false, actions, onSelect, disabled }: CueListItemProps) {
  return (
    <div className={`cue-list-item ${active ? "cue-list-item--active" : ""} ${!enabled ? "cue-list-item--disabled" : ""}`}>
      <button type="button" className="cue-list-item__select" onClick={onSelect} disabled={disabled} aria-current={active ? "true" : undefined}>
        <span className="cue-list-item__order">{order}.</span>
        <span className="cue-list-item__label">{label}</span>
        <span className={`cue-list-item__status cue-list-item__status--${status}`}>{status}</span>
      </button>
      {actions && <div className="cue-list-item__actions">{actions}</div>}
    </div>
  );
}

export function CueList({ children, heading, ariaLabel }: { children: ReactNode; heading?: string; ariaLabel?: string }) {
  return (
    <div className="cue-list" role="list" aria-label={ariaLabel ?? "Cue list"}>
      {heading && <h3 className="cue-list__heading">{heading}</h3>}
      <div className="cue-list__items">{children}</div>
    </div>
  );
}
