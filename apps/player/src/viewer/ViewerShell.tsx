import type { ReactNode } from "react";
import { PresentationRegion } from "../presentation/PresentationRegion";
import { InteractivePanels } from "./InteractivePanels";

export type ViewerProfile = "desktop" | "mobile" | "tv";

export function ViewerShell({ profile, video, diagnostics }: { profile: ViewerProfile; video: ReactNode; diagnostics: ReactNode }) {
  return <main className={`viewer-shell viewer-shell--${profile}`}>
    <PresentationRegion name="header" />
    <div className="viewer-shell__main">
      <PresentationRegion name="left.rail" />
      <div className="viewer-shell__programme">{video}</div>
      <PresentationRegion name="right.rail" />
    </div>
    {profile === "mobile" && <InteractivePanels />}
    <PresentationRegion name="footer" />
    {diagnostics}
  </main>;
}
