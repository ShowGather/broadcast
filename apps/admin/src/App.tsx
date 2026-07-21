import { useCallback, useEffect, useState } from "react";

interface StoredEvent {
  event: { id: string; t: string; p: Record<string, unknown> };
  injectedAt: string;
}
interface RundownCue { id: string; label: string; order: number; status: "pending" | "active" | "complete"; executionId?: string; }

function eventLabel(event: StoredEvent["event"]) {
  if (event.t === "presentation.cue") return `Cue: ${event.p.cue ?? "unknown"}`;
  if (event.t === "pc") return `Command: ${event.p.k ?? "unknown"}`;
  if (event.t === "presentation.clear") return "Safe Clear";
  return String(event.p.title ?? "Overlay");
}

export default function App() {
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(5000);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [rehearsal, setRehearsal] = useState(false);
  const [commandKind, setCommandKind] = useState("score");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [label, setLabel] = useState("");
  const [commandDuration, setCommandDuration] = useState(8000);
  const [rundown, setRundown] = useState<RundownCue[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/events");
      if (response.ok) setEvents(await response.json());
    } catch { /* Keep the latest known operator history. */ }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = window.setInterval(fetchEvents, 5_000);
    return () => window.clearInterval(interval);
  }, [fetchEvents]);

  const fetchRundown = useCallback(async () => {
    const response = await fetch(`/api/rundown/${rehearsal ? "rehearsal" : "live"}`);
    if (response.ok) setRundown((await response.json()).cues);
  }, [rehearsal]);
  useEffect(() => { fetchRundown().catch(() => {}); }, [fetchRundown]);

  const send = async (body: Record<string, unknown>, success: string) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(rehearsal ? "/api/rehearsal/events" : "/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setStatus(`${rehearsal ? "Rehearsal: " : "Live: "}${success} — ${result.event?.id ?? "queued"}`);
      if (!rehearsal) fetchEvents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send event");
    }
  };

  const sendCommand = () => {
    const duration = Number.isFinite(commandDuration) && commandDuration > 0 ? commandDuration : undefined;
    const command = commandKind === "score" ? { k: "score", h: Number(primary), a: Number(secondary), ...(label.trim() ? { l: label.trim() } : {}) }
      : commandKind === "lower" ? { k: "lower", t: primary.trim(), ...(secondary.trim() ? { s: secondary.trim() } : {}), ...(duration ? { d: duration } : {}) }
      : commandKind === "alert" ? { k: "alert", t: primary.trim(), m: secondary.trim(), x: "w", ...(duration ? { d: duration } : {}) }
      : commandKind === "sponsor" ? { k: "sponsor", b: primary.trim(), ...(secondary.trim() ? { s: secondary.trim() } : {}), ...(duration ? { d: duration } : {}) }
      : commandKind === "ticker" ? { k: "ticker", t: primary.trim(), ...(label.trim() ? { l: label.trim() } : {}) }
      : { k: "clear", ...(primary ? { g: primary } : {}), ...(secondary.trim() ? { y: secondary.trim() } : {}) };
    send({ command }, `${commandKind} command sent`);
  };

  const goCue = async (cue: RundownCue, rerun = false) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(`/api/rundown/${rehearsal ? "rehearsal" : "live"}/go`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cueId: cue.id, ...(rerun ? { rerun: true } : {}) }) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json(); setRundown(result.cues); setStatus(`${rehearsal ? "Rehearsal" : "Live"} rundown: ${cue.label} complete`); if (!rehearsal) fetchEvents();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to execute cue"); }
  };

  return <div className="container">
    <header className="header"><h1>ShowGather Broadcast — Control</h1><p>{rehearsal ? "Rehearsal cues go only to opted-in preview players." : "Live controls send compact, timed metadata to the HLS pipeline."}</p>
      <button className={`mode-toggle ${rehearsal ? "rehearsal" : ""}`} onClick={() => setRehearsal((current) => !current)}>{rehearsal ? "🟡 Rehearsal mode" : "🔴 Live mode"}</button>
    </header>

    <section className="section quick-cues">
      <h2>On-air cues</h2>
      <div className="cue-grid">
        <button onClick={() => send({ cue: "goal-home", durationMs: 15_000 }, "Home Goal sent")}>⚽ Home Goal</button>
        <button onClick={() => send({ cue: "speaker-intro", durationMs: 8_000 }, "Speaker intro sent")}>🎙 Speaker Intro</button>
        <button onClick={() => send({ cue: "alert-test", durationMs: 8_000 }, "Alert sent")}>⚠ Alert</button>
        <button className="safe-clear" onClick={() => send({ action: "safe-clear" }, "Safe Clear sent")}>✕ Safe Clear</button>
      </div>
      <p className="hint">Safe Clear removes presentation only. The programme video continues uninterrupted.</p>
    </section>

    <section className="section">
      <h2>Rundown — {rehearsal ? "Rehearsal" : "Live"}</h2>
      <p className="hint">GO uses an idempotent execution ID. Completed cues require explicit re-run; rehearsal state is separate from live.</p>
      <div className="cue-grid">
        {rundown.map((cue) => <div key={cue.id}><strong>{cue.order}. {cue.label}</strong><span className="hint"> {cue.status}</span><button disabled={cue.status === "active"} onClick={() => goCue(cue)}>GO</button>{cue.status === "complete" && <button onClick={() => goCue(cue, true)}>Re-run</button>}</div>)}
      </div>
    </section>

    <section className="section">
      <h2>Configurable presentation command</h2>
      <div className="form">
        <label><span>Action</span><select value={commandKind} onChange={(event) => { setCommandKind(event.target.value); setPrimary(""); setSecondary(""); setLabel(""); }}>
          <option value="score">Score update</option><option value="lower">Lower third</option><option value="alert">Alert</option><option value="sponsor">Sponsor takeover</option><option value="ticker">Ticker update</option><option value="clear">Regional clear</option>
        </select></label>
        {commandKind === "score" ? <><label><span>Home score</span><input type="number" min={0} max={999} value={primary} onChange={(event) => setPrimary(event.target.value)} /></label><label><span>Away score</span><input type="number" min={0} max={999} value={secondary} onChange={(event) => setSecondary(event.target.value)} /></label><label><span>Label</span><input value={label} maxLength={12} onChange={(event) => setLabel(event.target.value)} placeholder="GOAL" /></label></>
          : commandKind === "clear" ? <><label><span>Region</span><select value={primary} onChange={(event) => setPrimary(event.target.value)}><option value="">All regions</option><option value="v">Video overlay</option><option value="h">Header</option><option value="l">Left rail</option><option value="r">Right rail</option><option value="f">Footer</option></select></label><label><span>Layer (optional)</span><input value={secondary} maxLength={16} onChange={(event) => setSecondary(event.target.value)} placeholder="primary" /></label></>
          : <><label><span>{commandKind === "sponsor" ? "Brand" : commandKind === "ticker" ? "Ticker text" : "Title"}</span><input value={primary} maxLength={20} onChange={(event) => setPrimary(event.target.value)} /></label>{commandKind !== "ticker" && <label><span>{commandKind === "alert" ? "Message" : "Subtitle / tagline"}</span><input value={secondary} maxLength={20} onChange={(event) => setSecondary(event.target.value)} /></label>}{commandKind === "ticker" && <label><span>Label</span><input value={label} maxLength={12} onChange={(event) => setLabel(event.target.value)} /></label>}{commandKind !== "ticker" && <label><span>Duration (ms)</span><input type="number" min={1000} step={1000} value={commandDuration} onChange={(event) => setCommandDuration(Number(event.target.value))} /></label>}</>}
        <button onClick={sendCommand}>Send configurable command</button>
      </div>
      <p className="hint">Text is byte-bounded for the compact timed-ID3 envelope. Score, ticker, persistent sponsor, and clear update the late-join snapshot.</p>
    </section>

    <section className="section">
      <h2>Custom legacy overlay</h2>
      <div className="form">
        <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Goal!" /></label>
        <label><span>Message</span><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="e.g. 1–0" /></label>
        <label><span>Duration (ms)</span><input type="number" min={1000} step={1000} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
        <button onClick={() => send({ title: title.trim(), message: message.trim() || undefined, durationMs: duration }, "Overlay sent")}>Send Overlay</button>
      </div>
    </section>

    {status && <p className="status-msg">{status}</p>}
    {error && <p className="error-msg">{error}</p>}
    <section className="section"><h2>Recent on-air events</h2>
      {events.length === 0 ? <p className="empty">No events yet.</p> : <table className="events-table"><thead><tr><th>Event</th><th>Type</th><th>Time</th></tr></thead><tbody>
        {events.map((stored) => <tr key={stored.event.id}><td>{eventLabel(stored.event)}</td><td className="mono">{stored.event.t}</td><td className="mono">{new Date(stored.injectedAt).toLocaleTimeString()}</td></tr>)}
      </tbody></table>}
    </section>
  </div>;
}
