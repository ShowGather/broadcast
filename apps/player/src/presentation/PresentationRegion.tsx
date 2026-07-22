import type { CSSProperties, PropsWithChildren } from "react";
import { resolvePresentationTarget, type PresentationItem, type PresentationRegionName, type ResolvedPresentationInstance, type ViewerProfile } from "@showgather/presentation-model";
import { usePresentation } from "./PresentationProvider";

export function PresentationRegion({ name, profile = "desktop", children }: PropsWithChildren<{ name: PresentationRegionName; profile?: ViewerProfile }>) {
  const { state } = usePresentation();
  const items = resolvePresentationTarget(state, name, profile);
  return <section className={`presentation-region presentation-region--${name.replace(".", "-")}`} aria-label={name}>
    {items.map((instance) => <Graphic key={`${instance.entry.eventId}:${instance.entry.instanceId}`} instance={instance} />)}
    {children}
  </section>;
}

function Graphic({ instance }: { instance: ResolvedPresentationInstance }) {
  const { item } = instance.entry;
  const placement = instance.placement;
  const style = placementStyle(instance);
  const className = `graphic graphic--${item.kind} graphic--${item.kind}-${instance.variant} graphic--${placement.surface} graphic--${placement.anchor} graphic--${instance.transition.enter}`;
  switch (item.kind) {
    case "lower-third": return <div className={className} style={style}><strong>{item.title}</strong>{item.subtitle && <span>{item.subtitle}</span>}</div>;
    case "scorebug": return <div className={className} style={style}><span>{item.homeTeam}</span><b>{item.homeScore}</b><i>–</i><b>{item.awayScore}</b><span>{item.awayTeam}</span>{item.clock && <em>{item.clock}</em>}</div>;
    case "ticker": return <div className={className} style={style}>{item.label && <b>{item.label}</b>}<span>{item.text}</span></div>;
    case "alert": return <div className={`${className} graphic--alert-${item.severity}`} style={style}><b>{item.title}</b><span>{item.message}</span></div>;
    case "sponsor-panel": return <div className={className} style={{ ...style, ...(item.accent ? { borderColor: item.accent } : {}) }}><b>{item.brand}</b>{item.tagline && <span>{item.tagline}</span>}</div>;
  }
}

function placementStyle(instance: ResolvedPresentationInstance): CSSProperties {
  const { placement } = instance;
  const x = `${placement.x * 100}%`;
  const y = `${placement.y * 100}%`;
  const horizontal = placement.anchor.endsWith("left") ? { left: x } : placement.anchor.endsWith("right") ? { right: x } : { left: `calc(50% + ${x})` };
  const vertical = placement.anchor.startsWith("top") ? { top: y } : placement.anchor.startsWith("bottom") ? { bottom: y } : { top: `calc(50% + ${y})` };
  const translateX = placement.anchor.endsWith("centre") ? "-50%" : "0";
  const translateY = placement.anchor.startsWith("centre") ? "-50%" : "0";
  return {
    ...horizontal,
    ...vertical,
    width: `${placement.width * 100}%`,
    ...(placement.height === undefined ? {} : { height: `${placement.height * 100}%` }),
    ...(placement.opacity === undefined ? {} : { opacity: placement.opacity }),
    transform: `translate(${translateX}, ${translateY}) rotate(${placement.rotation ?? 0}deg)`,
    zIndex: instance.entry.zIndex ?? instance.entry.priority,
    transitionDuration: `${instance.transition.durationMs}ms`,
  };
}
