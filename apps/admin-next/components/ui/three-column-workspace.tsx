"use client";

import { type ReactNode } from "react";

interface ThreeColumnWorkspaceProps {
  left: ReactNode;
  centre: ReactNode;
  right: ReactNode;
  className?: string;
}

export function ThreeColumnWorkspace({ left, centre, right, className = "" }: ThreeColumnWorkspaceProps) {
  return (
    <div className={`workspace-page ${className}`}>
      <aside className="workspace-page__left">{left}</aside>
      <section className="workspace-page__centre">{centre}</section>
      <aside className="workspace-page__right">{right}</aside>
    </div>
  );
}
