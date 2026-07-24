import { type ReactNode } from "react";

interface ThreeColumnWorkspaceProps {
  left: ReactNode;
  centre: ReactNode;
  right: ReactNode;
  /** Optional className for workspace-specific styling (e.g. workspace--run) */
  className?: string;
  /** Optional modifier for wider centre column (Run/Viewer) */
  wideCentre?: boolean;
}

/**
 * Three-column workspace layout primitive.
 *
 * Columns:
 *   LEFT   — Selection and navigation (minmax(220px, 22%))
 *   CENTRE — Primary operator task    (minmax(420px, 48%))
 *   RIGHT  — Preview/status/recovery  (minmax(300px, 30%))
 *
 * Operator rule: Choose on the left, work in the centre, verify on the right.
 *
 * Responsive:
 *   Wide desktop:  LEFT | CENTRE | RIGHT
 *   Medium:        LEFT | CENTRE
 *                    RIGHT below centre
 *   Narrow:        LEFT / CENTRE / RIGHT (stacked)
 */
export function ThreeColumnWorkspace({ left, centre, right, className = "", wideCentre = false }: ThreeColumnWorkspaceProps) {
  return (
    <div className={`workspace-grid${wideCentre ? " workspace-grid--wide-centre" : ""} ${className}`}>
      <aside className="workspace-grid__left">{left}</aside>
      <main className="workspace-grid__centre">{centre}</main>
      <aside className="workspace-grid__right">{right}</aside>
    </div>
  );
}
