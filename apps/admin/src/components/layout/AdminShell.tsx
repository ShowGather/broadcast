import { type ReactNode } from "react";

interface AdminShellProps {
  className?: string;
  children: ReactNode;
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
export function AdminShell({
  className = "",
  children,
}: AdminShellProps) {
  return (
    <div className={`admin-shell ${className}`}>
      {children}
    </div>
  );
}
