import { useState } from "react";
import { resolvePresentationRegion, type PresentationItem } from "@showgather/presentation-model";
import { usePresentation } from "../presentation/PresentationProvider";

type Panel = "match" | "info" | "partners";

function first(items: PresentationItem[], kind: PresentationItem["kind"]) {
  return items.find((item) => item.kind === kind);
}

export function InteractivePanels() {
  const [panel, setPanel] = useState<Panel>("match");
  const { state } = usePresentation();
  const overlay = resolvePresentationRegion(state, "video.overlay").map((entry) => entry.item);
  const header = resolvePresentationRegion(state, "header").map((entry) => entry.item);
  const footer = resolvePresentationRegion(state, "footer").map((entry) => entry.item);
  const rails = ["left.rail", "right.rail"] as const;
  const sponsors = rails.flatMap((region) => resolvePresentationRegion(state, region).map((entry) => entry.item)).filter((item) => item.kind === "sponsor-panel");
  const score = first(overlay, "scorebug");
  const ticker = first(footer, "ticker") ?? first(header, "ticker");

  return <section className="interactive-panels" aria-label="Live companion panels">
    <div className="interactive-panels__tabs">
      {(["match", "info", "partners"] as Panel[]).map((candidate) => <button key={candidate} className={panel === candidate ? "active" : ""} onClick={() => setPanel(candidate)}>{candidate}</button>)}
    </div>
    {panel === "match" && <div className="interactive-panels__content">
      {score?.kind === "scorebug" ? <><strong>{score.homeTeam} <b>{score.homeScore}</b> – <b>{score.awayScore}</b> {score.awayTeam}</strong><span>{score.clock ?? "Live"} • presentation follows programme media time</span></> : <span>Waiting for match state…</span>}
    </div>}
    {panel === "info" && <div className="interactive-panels__content">{ticker?.kind === "ticker" ? <><strong>{ticker.label ?? "SHOWGATHER LIVE"}</strong><span>{ticker.text}</span></> : <span>Programme information will appear here.</span>}</div>}
    {panel === "partners" && <div className="interactive-panels__content">{sponsors.length ? sponsors.map((sponsor) => sponsor.kind === "sponsor-panel" && <div key={sponsor.brand}><strong>{sponsor.brand}</strong><span>{sponsor.tagline}</span></div>) : <span>No partner content is active.</span>}</div>}
  </section>;
}
