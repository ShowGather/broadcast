import type { PropsWithChildren } from "react";
import { resolvePresentationRegion, type PresentationItem, type PresentationRegionName } from "@showgather/presentation-model";
import { usePresentation } from "./PresentationProvider";

export function PresentationRegion({ name, children }: PropsWithChildren<{ name: PresentationRegionName }>) {
  const { state } = usePresentation();
  const items = resolvePresentationRegion(state, name);
  return <section className={`presentation-region presentation-region--${name.replace(".", "-")}`} aria-label={name}>
    {items.map((entry) => <Graphic key={entry.eventId} item={entry.item} />)}
    {children}
  </section>;
}

function Graphic({ item }: { item: PresentationItem }) {
  switch (item.kind) {
    case "lower-third": return <div className="graphic graphic--lower-third"><strong>{item.title}</strong>{item.subtitle && <span>{item.subtitle}</span>}</div>;
    case "scorebug": return <div className="graphic graphic--scorebug"><span>{item.homeTeam}</span><b>{item.homeScore}</b><i>–</i><b>{item.awayScore}</b><span>{item.awayTeam}</span>{item.clock && <em>{item.clock}</em>}</div>;
    case "ticker": return <div className="graphic graphic--ticker">{item.label && <b>{item.label}</b>}<span>{item.text}</span></div>;
    case "alert": return <div className={`graphic graphic--alert graphic--alert-${item.severity}`}><b>{item.title}</b><span>{item.message}</span></div>;
    case "sponsor-panel": return <div className="graphic graphic--sponsor-panel" style={item.accent ? { borderColor: item.accent } : undefined}><b>{item.brand}</b>{item.tagline && <span>{item.tagline}</span>}</div>;
  }
}
