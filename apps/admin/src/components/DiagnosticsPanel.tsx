import type { OutboxItem, StoredEvent } from "../types.js";

function eventLabel(event: StoredEvent["event"]) {
  if (event.t === "presentation.cue") return `Cue: ${event.p.cue ?? "unknown"}`;
  if (event.t === "pc") return `Command: ${event.p.k ?? "unknown"}`;
  if (event.t === "presentation.clear") return "Safe Clear";
  return String(event.p.title ?? "Overlay");
}

interface Props {
  workspace: string;
  events: StoredEvent[];
  outbox: OutboxItem[];
  resolveOutbox: (item: OutboxItem, action: "retry" | "cancel") => Promise<void>;
}

export function DiagnosticsPanel({ workspace, events, outbox, resolveOutbox }: Props) {
  return <aside className="diagnostics-panel" aria-label="Technical diagnostics">
    <p>Technical diagnostics are secondary. They expose delivery history and recovery detail without changing presentation state.</p>
    {workspace !== "run" && <section className="section"><h2>Recent on-air events</h2>
      {events.length === 0 ? <p className="empty">No events yet.</p> : <table className="events-table"><thead><tr><th>Event</th><th>Type</th><th>Time</th></tr></thead><tbody>
        {events.map((stored) => <tr key={stored.event.id}><td>{eventLabel(stored.event)}</td><td className="mono">{stored.event.t}</td><td className="mono">{new Date(stored.injectedAt).toLocaleTimeString()}</td></tr>)}
      </tbody></table>}
    </section>}
    <section className="section"><h2>Live dispatch status</h2>
      {outbox.length === 0 ? <p className="empty">No durable commands have been submitted.</p> : <table className="events-table"><thead><tr><th>Command</th><th>Revision</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {outbox.map((item) => <tr key={item.id}><td>{item.label}{workspace !== "run" && <><br /><span className="hint mono">{item.eventId}</span></>}{item.error && <p className="error-msg">{item.error}</p>}</td><td>{item.revision}</td><td>{item.status}</td><td>{item.retryable && <button onClick={() => resolveOutbox(item, "retry")}>Retry</button>}{item.cancellable && <button className="safe-clear" onClick={() => resolveOutbox(item, "cancel")}>Cancel</button>}</td></tr>)}
      </tbody></table>}
    </section>
  </aside>;
}
