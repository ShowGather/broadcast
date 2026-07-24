import type { CSSProperties, PropsWithChildren } from "react";
import { resolvePresentationTarget, type PresentationItem, type PresentationLayoutDefinition, type PresentationRegionName, type ResolvedPresentationInstance, type ViewerProfile } from "@showgather/presentation-model";
import { usePresentation } from "./presentation-provider";

export function PresentationRegion({ name, profile = "desktop", definitions, children }: PropsWithChildren<{ name: PresentationRegionName; profile?: ViewerProfile; definitions?: readonly PresentationLayoutDefinition[] }>) {
  const { state } = usePresentation();
  const items = resolvePresentationTarget(state, name, profile, definitions);
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
    case "clock": return <div className={className} style={style}>{item.label && <b>{item.label}</b>}<time>{item.time}</time></div>;
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
  const stackOffset = placement.layout === "column" ? instance.stackIndex * (placement.anchor.startsWith("bottom") ? -112 : 112) : 0;
  const rowOffset = placement.layout === "row" ? instance.stackIndex * 108 : 0;
  const crop = placement.crop;
  return {
    ...horizontal,
    ...vertical,
    width: `${placement.width * 100}%`,
    ...(placement.height === undefined ? {} : { height: `${placement.height * 100}%` }),
    ...(placement.opacity === undefined ? {} : { opacity: placement.opacity }),
    transform: `translate(calc(${translateX} + ${rowOffset}%), calc(${translateY} + ${stackOffset}%)) rotate(${placement.rotation ?? 0}deg)`,
    zIndex: instance.entry.zIndex ?? instance.entry.priority,
    ...(crop === undefined ? {} : { clipPath: `inset(${crop.top * 100}% ${crop.right * 100}% ${crop.bottom * 100}% ${crop.left * 100}%)` }),
    transitionDuration: `${instance.transition.durationMs}ms`,
    animationDuration: `${instance.transition.durationMs}ms`,
  };
}
