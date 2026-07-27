import { type ReactNode } from "react";

interface AdminShellProps {
  topBar: ReactNode;
  farLeft: ReactNode;
  centreTop: ReactNode;
  centreBottom: ReactNode;
  farRight: ReactNode;
  statusBar: ReactNode;
  className?: string;
}

/**
 * AdminShell - Main container with CSS Grid named areas matching the wireframe.
 *
 * Layout areas:
 *   top-bar    - Full width: ShowGather identity | workspace tabs | system state
 *   far-left   - Elements column (productions, configs, etc.)
 *   centre-top - Programme composition (left rail | 16:9 video | right rail)
 *   centre-bottom - Dynamic controls (workspace-specific controls)
 *   far-right  - Cue stack + GO button
 *   status-bar - Full width bottom bar with system data
 *
 * Responsive behavior:
 *   >=1100px:  top-bar spans full width; three-column layout for main areas
 *   <1100px:   reduce widths of side columns
 *   <850px:    stack vertically (top-bar, far-left, centre-top, centre-bottom, far-right, status-bar)
 */
export function AdminShell({ topBar, farLeft, centreTop, centreBottom, farRight, statusBar, className = "" }: AdminShellProps) {
  return (
    <div className={`admin-shell ${className}`.trim()}>
      <header className="admin-shell__top-bar">{topBar}</header>
      <aside className="admin-shell__far-left">{farLeft}</aside>
      <main className="admin-shell__centre-top">{centreTop}</main>
      <section className="admin-shell__centre-bottom">{centreBottom}</section>
      <aside className="admin-shell__far-right">{farRight}</aside>
      <footer className="admin-shell__status-bar">{statusBar}</footer>
    </div>
  );
}
