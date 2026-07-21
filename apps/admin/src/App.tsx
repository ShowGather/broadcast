import { useCallback, useEffect, useState } from "react";

interface StoredEvent {
  event: { id: string; t: string; p: Record<string, unknown> };
  injectedAt: string;
}

function eventLabel(event: StoredEvent["event"]) {
  if (event.t === "presentation.cue") return `Cue: ${event.p.cue ?? "unknown"}`;
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
