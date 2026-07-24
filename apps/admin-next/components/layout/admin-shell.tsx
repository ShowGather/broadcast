"use client";

import { type ReactNode } from "react";

interface AdminShellProps {
  topBar: ReactNode;
  workspace: ReactNode;
  statusBar: ReactNode;
}

export function AdminShell({ topBar, workspace, statusBar }: AdminShellProps) {
  return (
    <div className="app-root">
      <header className="admin-top-bar">{topBar}</header>
      <main className="admin-shell">{workspace}</main>
      <footer className="admin-status-bar">{statusBar}</footer>
    </div>
  );
}
