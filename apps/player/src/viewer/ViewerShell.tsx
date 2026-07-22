import type { ReactNode } from "react";
import { PresentationRegion } from "../presentation/PresentationRegion";
import { resolvePresentationRegion } from "@showgather/presentation-model";
import { usePresentation } from "../presentation/PresentationProvider";
import { InteractivePanels, type CompanionPanel, type CompanionPanelLabels } from "./InteractivePanels";

export type ViewerProfile = "desktop" | "mobile" | "tv";

export function ViewerShell({ profile, video, diagnostics, enabledPanels, panelLabels }: { profile: ViewerProfile; video: ReactNode; diagnostics: ReactNode; enabledPanels?: CompanionPanel[]; panelLabels?: CompanionPanelLabels }) {
  const { state } = usePresentation();
  const hasHeader = resolvePresentationRegion(state, "header").length > 0;
  const hasLeft = resolvePresentationRegion(state, "left.rail").length > 0;
  const hasRight = resolvePresentationRegion(state, "right.rail").length > 0;
  const hasFooter = resolvePresentationRegion(state, "footer").length > 0;
  return <main className={`viewer-shell viewer-shell--${profile}`}>
    {hasHeader && <PresentationRegion name="header" />}
    <div className={`viewer-shell__main ${hasLeft ? "has-left" : ""} ${hasRight ? "has-right" : ""}`}>
      {hasLeft && <PresentationRegion name="left.rail" />}
      <div className="viewer-shell__programme">{video}</div>
      {hasRight && <PresentationRegion name="right.rail" />}
    </div>
    {profile === "mobile" && <InteractivePanels enabled={enabledPanels} labels={panelLabels} />}
    {hasFooter && <PresentationRegion name="footer" />}
    {diagnostics}
  </main>;
}
