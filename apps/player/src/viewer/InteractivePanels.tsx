import { useEffect, useRef, useState } from "react";
import { resolvePresentationRegion, resolvePresentationSurface, type PresentationItem, type PresentationLayoutDefinition } from "@showgather/presentation-model";
import { usePresentation } from "../presentation/PresentationProvider";

export type CompanionPanel = "match" | "info" | "partners" | "interact";
export type CompanionPanelLabels = Partial<Record<CompanionPanel, string>>;

function first(items: PresentationItem[], kind: PresentationItem["kind"]) {
  return items.find((item) => item.kind === kind);
}

function CompanionGraphic({ item }: { item: PresentationItem }) {
  switch (item.kind) {
    case "scorebug": return <div><strong>{item.homeTeam} <b>{item.homeScore}</b> – <b>{item.awayScore}</b> {item.awayTeam}</strong><span>{item.clock ?? "Live"}</span></div>;
    case "ticker": return <div><strong>{item.label ?? "SHOWGATHER LIVE"}</strong><span>{item.text}</span></div>;
    case "sponsor-panel": return <div><strong>{item.brand}</strong><span>{item.tagline}</span></div>;
    case "lower-third": return <div><strong>{item.title}</strong>{item.subtitle && <span>{item.subtitle}</span>}</div>;
    case "alert": return <div><strong>{item.title}</strong><span>{item.message}</span></div>;
    case "clock": return <div><strong>{item.label ?? "LIVE"}</strong><span>{item.time}</span></div>;
  }
}

export function InteractivePanels({ enabled = ["match", "info", "partners", "interact"], labels = {}, layoutDefinitions = [] }: { enabled?: CompanionPanel[]; labels?: CompanionPanelLabels; layoutDefinitions?: readonly PresentationLayoutDefinition[] }) {
  const [panel, setPanel] = useState<CompanionPanel>(enabled[0] ?? "match");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => { if (!enabled.includes(panel)) setPanel(enabled[0] ?? "match"); }, [enabled, panel]);
  const { state } = usePresentation();
  const overlay = resolvePresentationRegion(state, "video.overlay").map((entry) => entry.item);
  const header = resolvePresentationRegion(state, "header").map((entry) => entry.item);
  const footer = resolvePresentationRegion(state, "footer").map((entry) => entry.item);
  const rails = ["left.rail", "right.rail"] as const;
  const sponsors = rails.flatMap((region) => resolvePresentationRegion(state, region).map((entry) => entry.item)).filter((item) => item.kind === "sponsor-panel");
  const score = first(overlay, "scorebug");
  const ticker = first(footer, "ticker") ?? first(header, "ticker");
  const companion = resolvePresentationSurface(state, "companion", "mobile", layoutDefinitions).map((instance) => instance.entry.item);
  const companionSponsors = companion.filter((item) => item.kind === "sponsor-panel");
  const companionMatch = companion.filter((item) => item.kind === "scorebug");
  const companionInformation = companion.filter((item) => item.kind === "ticker" || item.kind === "lower-third" || item.kind === "alert" || item.kind === "clock");
  const companionInteraction = companion.filter((item) => item.kind !== "scorebug" && item.kind !== "ticker" && item.kind !== "lower-third" && item.kind !== "alert" && item.kind !== "clock" && item.kind !== "sponsor-panel");
  const companionTicker = first(companion, "ticker");
  const informationTicker = companionTicker?.kind === "ticker" ? companionTicker : ticker?.kind === "ticker" ? ticker : undefined;

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length;
    setPanel(enabled[next]!); tabs.current[next]?.focus();
  };
  const label = (candidate: CompanionPanel) => labels[candidate] ?? candidate[0]!.toUpperCase() + candidate.slice(1);

  return <section className="interactive-panels" aria-label="Live companion panels">
    <div className="interactive-panels__tabs" role="tablist" aria-label="Programme companion">
      {enabled.map((candidate, index) => <button key={candidate} ref={(element) => { tabs.current[index] = element; }} id={`companion-tab-${candidate}`} role="tab" aria-selected={panel === candidate} aria-controls={`companion-panel-${candidate}`} tabIndex={panel === candidate ? 0 : -1} className={panel === candidate ? "active" : ""} onKeyDown={(event) => onKeyDown(event, index)} onClick={() => setPanel(candidate)}>{label(candidate)}</button>)}
    </div>
    {panel === "match" && <div id="companion-panel-match" role="tabpanel" aria-labelledby="companion-tab-match" className="interactive-panels__content">
      {companionMatch.length ? companionMatch.map((item, index) => <CompanionGraphic key={`companion-match-${index}`} item={item} />) : score?.kind === "scorebug" ? <><strong>{score.homeTeam} <b>{score.homeScore}</b> – <b>{score.awayScore}</b> {score.awayTeam}</strong><span>{score.clock ?? "Live"} • presentation follows programme media time</span></> : <span>Waiting for match state…</span>}
    </div>}
    {panel === "info" && <div id="companion-panel-info" role="tabpanel" aria-labelledby="companion-tab-info" className="interactive-panels__content">{companionInformation.length ? companionInformation.map((item, index) => <CompanionGraphic key={`companion-info-${index}`} item={item} />) : informationTicker ? <><strong>{informationTicker.label ?? "SHOWGATHER LIVE"}</strong><span>{informationTicker.text}</span></> : <span>Programme information will appear here.</span>}</div>}
    {panel === "partners" && <div id="companion-panel-partners" role="tabpanel" aria-labelledby="companion-tab-partners" className="interactive-panels__content">{[...companionSponsors, ...sponsors].length ? [...companionSponsors, ...sponsors].map((sponsor, index) => sponsor.kind === "sponsor-panel" && <div key={`${sponsor.brand}-${index}`}><strong>{sponsor.brand}</strong><span>{sponsor.tagline}</span></div>) : <span>No partner content is active.</span>}</div>}
    {panel === "interact" && <div id="companion-panel-interact" role="tabpanel" aria-labelledby="companion-tab-interact" className="interactive-panels__content">{companionInteraction.length ? companionInteraction.map((item, index) => <CompanionGraphic key={`companion-interact-${index}`} item={item} />) : <><strong>Interactive</strong><span>Audience choices and live participation will appear here when enabled for this programme.</span></>}</div>}
  </section>;
}
