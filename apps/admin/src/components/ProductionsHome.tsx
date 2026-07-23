import type { Channel, Production, Rundown } from "../types.js";
import { useAdminState } from "./AdminStateContext.js";

interface Props {
  channels: Channel[];
  productions: Production[];
  rundowns: Rundown[];
  setProductionId: (id: string) => void;
  createProduction: (fresh?: boolean) => Promise<void>;
  refreshProductions: () => Promise<void>;
}

export function ProductionsHome({ channels, productions, rundowns, setProductionId, createProduction, refreshProductions }: Props) {
  const { productionId, channelId, navigate, mutate } = useAdminState();
  return <section className="section productions-home">
    <div className="workspace-heading"><div><h2>Productions</h2><p className="hint">Open a saved production to prepare, rehearse, or run it. Technical delivery details remain outside this starting view.</p></div><button onClick={() => createProduction(true)} disabled={!channelId}>New production</button></div>
    {productions.length === 0 ? <div className="productions-empty"><h3>You have not created a production yet.</h3><p>A production contains your programme details, viewer presentation, rundown, and live controls.</p><button onClick={() => createProduction(true)} disabled={!channelId}>Create your first production</button></div>
      : <div className="production-cards">{productions.map((production) => {
        const productionRundowns = production.id === productionId ? rundowns : [];
        return <article key={production.id} className="production-card"><div><span className={`production-card__status production-card__status--${production.status}`}>{production.status}</span><h3>{production.title}</h3><p>{channels.find((channel) => channel.id === production.channelId)?.name ?? "Selected channel"}{production.scheduledStart ? ` \u00b7 ${new Date(production.scheduledStart).toLocaleString()}` : " \u00b7 No schedule"}</p><p className="hint">{productionRundowns.length ? `${productionRundowns.length} rundown${productionRundowns.length === 1 ? "" : "s"}` : "No rundown created"} \u00b7 {production.configuration ? "Show configuration selected" : "No show configuration"}</p></div><div className="production-card__actions"><button onClick={() => { setProductionId(production.id); navigate({ workspace: "prepare", productionId: production.id, prepareTab: "overview" }); }}>{productionRundowns.length ? "Open" : "Continue setup"}</button><button onClick={async () => { const result = await mutate(`/api/productions/${production.id}/duplicate`, "POST", {}, "Production duplicated"); if (result?.id) { await refreshProductions(); } }}>Duplicate</button></div></article>;
      })}</div>}
  </section>;
}
