import type { ReactNode } from "react";
import { PresentationRegion } from "../presentation/PresentationRegion";
import { resolvePresentationTarget } from "@showgather/presentation-model";
import { usePresentation } from "../presentation/PresentationProvider";
import { InteractivePanels, type CompanionPanel, type CompanionPanelLabels } from "./InteractivePanels";

export type ViewerProfile = "desktop" | "mobile" | "tv";

export function ViewerShell({ profile, video, diagnostics, enabledPanels, panelLabels }: { profile: ViewerProfile; video: ReactNode; diagnostics: ReactNode; enabledPanels?: CompanionPanel[]; panelLabels?: CompanionPanelLabels }) {
  const { state } = usePresentation();
  const hasHeader = resolvePresentationTarget(state, "header", profile).length > 0;
  const hasLeft = resolvePresentationTarget(state, "left.rail", profile).length > 0;
  const hasRight = resolvePresentationTarget(state, "right.rail", profile).length > 0;
  const hasFooter = resolvePresentationTarget(state, "footer", profile).length > 0;
  return <main className={`viewer-shell viewer-shell--${profile}`}>
    {hasHeader && <PresentationRegion name="header" profile={profile} />}
    <div className={`viewer-shell__main ${hasLeft ? "has-left" : ""} ${hasRight ? "has-right" : ""}`}>
      {hasLeft && <PresentationRegion name="left.rail" profile={profile} />}
      <div className="viewer-shell__programme">{video}</div>
      {hasRight && <PresentationRegion name="right.rail" profile={profile} />}
    </div>
    {profile === "mobile" && <InteractivePanels enabled={enabledPanels} labels={panelLabels} />}
    {hasFooter && <PresentationRegion name="footer" profile={profile} />}
    {diagnostics}
  </main>;
}
