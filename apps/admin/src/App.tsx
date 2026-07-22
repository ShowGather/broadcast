import { useCallback, useEffect, useState } from "react";

interface StoredEvent {
  event: { id: string; t: string; p: Record<string, unknown> };
  injectedAt: string;
}
interface RundownCue { id: string; label: string; order: number; status: "pending" | "active" | "complete" | "failed" | "cancelled"; executionId?: string; }
interface Channel { id: string; name: string; slug: string; status: string; }
interface Production { id: string; title: string; description?: string | null; status: string; scheduledStart?: string | null; scheduledEnd?: string | null; configuration?: Record<string, unknown> | null; showConfigurationId?: string | null; }
interface Rundown { id: string; name: string; version: number; }
interface RundownDefinitionCue { id: string; label: string; position: number; enabled: boolean; commandPayload: Record<string, unknown>; }
interface ShowConfiguration { id: string; name: string; configuration: Record<string, unknown>; }
interface OutboxItem { id: string; eventId: string; revision: number; label: string; status: "pending" | "dispatched" | "failed" | "cancelled"; error?: string; retryable: boolean; cancellable: boolean; }

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
  const [apiConnection, setApiConnection] = useState<"checking" | "connected" | "offline">("checking");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [rundowns, setRundowns] = useState<Rundown[]>([]);
  const [channelId, setChannelId] = useState(() => localStorage.getItem("showgather.channelId") ?? "");
  const [productionId, setProductionId] = useState(() => localStorage.getItem("showgather.productionId") ?? "");
  const [rundownId, setRundownId] = useState(() => localStorage.getItem("showgather.rundownId") ?? "");
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const [productionTitle, setProductionTitle] = useState("");
  const [productionDescription, setProductionDescription] = useState("");
  const [productionStatus, setProductionStatus] = useState("draft");
  const [rundownName, setRundownName] = useState("");
  const [rundownDefinition, setRundownDefinition] = useState<RundownDefinitionCue[]>([]);
  const [configurationName, setConfigurationName] = useState("Football package");
  const [homeTeam, setHomeTeam] = useState("HOME");
  const [awayTeam, setAwayTeam] = useState("AWAY");
  const [tickerLabel, setTickerLabel] = useState("LIVE");
  const [configurations, setConfigurations] = useState<ShowConfiguration[]>([]);

  useEffect(() => {
    fetch("/api/channels").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load channels");
      const items = await response.json() as Channel[]; setChannels(items);
      setChannelId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load channels"));
  }, []);
  useEffect(() => { if (channelId) localStorage.setItem("showgather.channelId", channelId); }, [channelId]);
  useEffect(() => { if (productionId) localStorage.setItem("showgather.productionId", productionId); }, [productionId]);
  useEffect(() => { if (rundownId) localStorage.setItem("showgather.rundownId", rundownId); }, [rundownId]);
  useEffect(() => {
    if (!channelId) return;
    fetch(`/api/channels/${channelId}/productions`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load productions");
      const items = await response.json() as Production[]; setProductions(items);
      setProductionId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load productions"));
  }, [channelId]);
  useEffect(() => {
    if (!productionId) return;
    fetch(`/api/productions/${productionId}/rundowns`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load rundowns");
      const items = await response.json() as Rundown[]; setRundowns(items);
      setRundownId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load rundowns"));
  }, [productionId]);
  const reloadProduction = useCallback(async () => {
    if (!productionId) return;
    const response = await fetch(`/api/productions/${productionId}`);
    if (!response.ok) throw new Error("Unable to load production");
    const item = await response.json() as Production;
    setProductionTitle(item.title); setProductionDescription(item.description ?? ""); setProductionStatus(item.status);
  }, [productionId]);
  const reloadRundownDefinition = useCallback(async () => {
    if (!rundownId) return;
    const response = await fetch(`/api/rundowns/${rundownId}`);
    if (!response.ok) throw new Error("Unable to load rundown editor");
    const item = await response.json() as { name: string; cues: RundownDefinitionCue[] };
    setRundownName(item.name); setRundownDefinition(item.cues);
  }, [rundownId]);
  const reloadConfigurations = useCallback(async () => {
    if (!channelId) return;
    const response = await fetch(`/api/channels/${channelId}/show-configurations`);
    if (!response.ok) throw new Error("Unable to load show configurations");
    setConfigurations(await response.json() as ShowConfiguration[]);
  }, [channelId]);
  useEffect(() => { reloadProduction().catch((reason) => setSelectionError(reason.message)); }, [reloadProduction]);
  useEffect(() => { reloadRundownDefinition().catch((reason) => setSelectionError(reason.message)); }, [reloadRundownDefinition]);
  useEffect(() => { reloadConfigurations().catch((reason) => setSelectionError(reason.message)); }, [reloadConfigurations]);

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
    if (!rundownId) return;
    const response = await fetch(`/api/rundown/${rehearsal ? "rehearsal" : "live"}?rundownId=${encodeURIComponent(rundownId)}`);
    if (response.ok) setRundown((await response.json()).cues);
  }, [rehearsal, rundownId]);
  useEffect(() => { fetchRundown().catch(() => {}); }, [fetchRundown]);

  const fetchOutbox = useCallback(async () => {
    if (!channelId) return;
    const response = await fetch(`/api/channels/${channelId}/presentation/outbox`);
    if (response.ok) setOutbox(await response.json());
  }, [channelId]);
  useEffect(() => { fetchOutbox().catch(() => {}); const interval = window.setInterval(() => { fetchOutbox().catch(() => {}); }, 5_000); return () => window.clearInterval(interval); }, [fetchOutbox]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try { const response = await fetch("/api/health"); if (active) setApiConnection(response.ok ? "connected" : "offline"); }
      catch { if (active) setApiConnection("offline"); }
    };
    check(); const interval = window.setInterval(check, 5_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const send = async (body: Record<string, unknown>, success: string) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(rehearsal ? "/api/rehearsal/events" : "/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setStatus(`${rehearsal ? "Rehearsal: " : "Live: "}${success} — ${result.event?.id ?? "queued"} (${result.status ?? "pending"})`);
      if (!rehearsal) fetchEvents();
      if (!rehearsal) fetchOutbox();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send event");
    }
  };

  const currentCommand = () => {
    const duration = Number.isFinite(commandDuration) && commandDuration > 0 ? commandDuration : undefined;
    return commandKind === "score" ? { k: "score", h: Number(primary), a: Number(secondary), ...(label.trim() ? { l: label.trim() } : {}) }
      : commandKind === "lower" ? { k: "lower", t: primary.trim(), ...(secondary.trim() ? { s: secondary.trim() } : {}), ...(duration ? { d: duration } : {}) }
      : commandKind === "alert" ? { k: "alert", t: primary.trim(), m: secondary.trim(), x: "w", ...(duration ? { d: duration } : {}) }
      : commandKind === "sponsor" ? { k: "sponsor", b: primary.trim(), ...(secondary.trim() ? { s: secondary.trim() } : {}), ...(duration ? { d: duration } : {}) }
      : commandKind === "ticker" ? { k: "ticker", t: primary.trim(), ...(label.trim() ? { l: label.trim() } : {}) }
      : { k: "clear", ...(primary ? { g: primary } : {}), ...(secondary.trim() ? { y: secondary.trim() } : {}) };
  };
  const sendCommand = () => send({ command: currentCommand() }, `${commandKind} command sent`);

  const mutate = async (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json() as { id?: string };
      setStatus(success);
      await reload?.();
      return result;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save"); return undefined; }
  };
  const refreshShowContext = async () => { await reloadProduction(); await reloadRundownDefinition(); await reloadConfigurations(); };
  const createProduction = async () => {
    const result = await mutate(`/api/channels/${channelId}/productions`, "POST", { title: productionTitle || "New production", description: productionDescription, status: productionStatus }, "Production created");
    if (result?.id) { setProductions(await (await fetch(`/api/channels/${channelId}/productions`)).json() as Production[]); setProductionId(result.id); }
  };
  const duplicateProduction = async () => {
    const result = await mutate(`/api/productions/${productionId}/duplicate`, "POST", {}, "Production duplicated");
    if (result?.id) { setProductions(await (await fetch(`/api/channels/${channelId}/productions`)).json() as Production[]); setProductionId(result.id); }
  };
  const addCue = async () => { await mutate(`/api/rundowns/${rundownId}/cues`, "POST", { label: label.trim() || `${commandKind} cue`, command: currentCommand(), enabled: true }, "Cue saved", async () => { await reloadRundownDefinition(); await fetchRundown(); }); };
  const editCue = async (cue: RundownDefinitionCue, changes: Record<string, unknown>) => { await mutate(`/api/rundown-cues/${cue.id}`, "PUT", changes, "Cue updated", async () => { await reloadRundownDefinition(); await fetchRundown(); }); };
  const moveCue = async (index: number, direction: -1 | 1) => {
    const reordered = [...rundownDefinition]; const next = index + direction; if (next < 0 || next >= reordered.length) return;
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    await mutate(`/api/rundowns/${rundownId}/cues/reorder`, "POST", { cueIds: reordered.map((cue) => cue.id) }, "Cue order saved", reloadRundownDefinition);
  };

  const goCue = async (cue: RundownCue, rerun = false) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(`/api/rundown/${rehearsal ? "rehearsal" : "live"}/go?rundownId=${encodeURIComponent(rundownId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cueId: cue.id, ...(rerun ? { rerun: true } : {}) }) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json(); setRundown(result.cues); setStatus(`${rehearsal ? "Rehearsal" : "Live"} rundown: ${cue.label} ${result.dispatchStatus ?? "complete"}`); if (!rehearsal) { fetchEvents(); fetchOutbox(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to execute cue"); }
  };

  const resolveOutbox = async (item: OutboxItem, action: "retry" | "cancel") => {
    setError(""); setStatus("");
    try {
      const response = await fetch(`/api/channels/${channelId}/presentation/outbox/${item.id}/${action}`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setStatus(`${item.label} revision ${item.revision}: ${result.status}`); await fetchOutbox(); await fetchRundown();
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to ${action} command`); }
  };

  return <div className="container">
    <header className="header"><h1>ShowGather Broadcast — Control</h1><p>{rehearsal ? "Rehearsal cues go only to opted-in preview players." : "Live controls send compact, timed metadata to the HLS pipeline."}</p><p className={`connection connection--${apiConnection}`}>API {apiConnection}</p>
      <button className={`mode-toggle ${rehearsal ? "rehearsal" : ""}`} onClick={() => setRehearsal((current) => !current)}>{rehearsal ? "🟡 Rehearsal mode" : "🔴 Live mode"}</button>
    </header>

    <section className="section">
      <h2>Show context</h2>
      <div className="form">
        <label><span>Channel</span><select value={channelId} onChange={(event) => setChannelId(event.target.value)}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></label>
        <label><span>Production</span><select value={productionId} onChange={(event) => setProductionId(event.target.value)}>{productions.map((production) => <option key={production.id} value={production.id}>{production.title}</option>)}</select></label>
        <label><span>Rundown</span><select value={rundownId} onChange={(event) => setRundownId(event.target.value)}>{rundowns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      {selectionError && <p className="error-msg">{selectionError}</p>}
    </section>

    <section className="section">
      <h2>Production editor</h2>
      <div className="form">
        <label><span>Title</span><input value={productionTitle} onChange={(event) => setProductionTitle(event.target.value)} /></label>
        <label><span>Description</span><input value={productionDescription} onChange={(event) => setProductionDescription(event.target.value)} /></label>
        <label><span>Status</span><select value={productionStatus} onChange={(event) => setProductionStatus(event.target.value)}><option value="draft">Draft</option><option value="rehearsal">Rehearsal</option><option value="live">Live</option><option value="complete">Complete</option><option value="archived">Archived</option></select></label>
        <button onClick={createProduction}>Create production</button><button disabled={!productionId} onClick={() => mutate(`/api/productions/${productionId}`, "PUT", { title: productionTitle, description: productionDescription, status: productionStatus }, "Production saved", refreshShowContext)}>Save production</button><button disabled={!productionId} onClick={duplicateProduction}>Duplicate production</button>
      </div>
      <h3>Reusable show configuration</h3>
      <div className="form">
        <label><span>Package name</span><input value={configurationName} onChange={(event) => setConfigurationName(event.target.value)} /></label>
        <label><span>Home team</span><input maxLength={20} value={homeTeam} onChange={(event) => setHomeTeam(event.target.value)} /></label>
        <label><span>Away team</span><input maxLength={20} value={awayTeam} onChange={(event) => setAwayTeam(event.target.value)} /></label>
        <label><span>Ticker label</span><input maxLength={12} value={tickerLabel} onChange={(event) => setTickerLabel(event.target.value)} /></label>
        <button onClick={() => mutate(`/api/channels/${channelId}/show-configurations`, "POST", { name: configurationName, configuration: { sport: "football", homeTeam, awayTeam, tickerLabel } }, "Show configuration saved", reloadConfigurations)}>Save reusable configuration</button>
        <label><span>Copy into production</span><select onChange={(event) => { if (event.target.value) mutate(`/api/productions/${productionId}/copy-configuration`, "POST", { configurationId: event.target.value }, "Configuration copied into production", reloadProduction); }} defaultValue=""><option value="">Choose a saved package</option>{configurations.map((configuration) => <option key={configuration.id} value={configuration.id}>{configuration.name}</option>)}</select></label>
      </div>
      <p className="hint">Packages are copied into a production deliberately. Changing a package never rewrites an existing production.</p>
    </section>

    <section className="section">
      <h2>Rundown editor</h2>
      <div className="form"><label><span>Rundown name</span><input value={rundownName} onChange={(event) => setRundownName(event.target.value)} /></label><button disabled={!productionId} onClick={async () => { const result = await mutate(`/api/productions/${productionId}/rundowns`, "POST", { name: rundownName || "New rundown" }, "Rundown created"); if (result?.id) { setRundowns(await (await fetch(`/api/productions/${productionId}/rundowns`)).json() as Rundown[]); setRundownId(result.id); } }}>Create rundown</button><button disabled={!rundownId} onClick={() => mutate(`/api/rundowns/${rundownId}`, "PUT", { name: rundownName }, "Rundown saved", reloadRundownDefinition)}>Save rundown</button><button disabled={!rundownId} onClick={async () => { const result = await mutate(`/api/rundowns/${rundownId}/duplicate`, "POST", {}, "Rundown duplicated"); if (result?.id) { setRundowns(await (await fetch(`/api/productions/${productionId}/rundowns`)).json() as Rundown[]); setRundownId(result.id); } }}>Duplicate rundown</button></div>
      {rundownDefinition.map((cue, index) => <div className="cue-grid" key={cue.id}><strong>{cue.position}. {cue.label}</strong><span className="hint">{String(cue.commandPayload.k)} {cue.enabled ? "enabled" : "disabled"}</span><button onClick={() => editCue(cue, { enabled: !cue.enabled })}>{cue.enabled ? "Disable" : "Enable"}</button><button disabled={index === 0} onClick={() => moveCue(index, -1)}>Move up</button><button disabled={index === rundownDefinition.length - 1} onClick={() => moveCue(index, 1)}>Move down</button></div>)}
      <p className="hint">The typed command form below can send immediately or save a new cue into this rundown. Execution sessions use a frozen copy of this definition.</p>
    </section>

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
      <button disabled={!rundownId} onClick={() => mutate(`/api/rundown/${rehearsal ? "rehearsal" : "live"}/sessions?rundownId=${encodeURIComponent(rundownId)}`, "POST", {}, `${rehearsal ? "Rehearsal" : "Live"} session started`, fetchRundown)}>Start new {rehearsal ? "rehearsal" : "live"} session</button>
      <div className="cue-grid">
        {rundown.map((cue) => <div key={cue.id}><strong>{cue.order}. {cue.label}</strong><span className="hint"> {cue.status}</span><button disabled={cue.status === "active" || cue.status === "cancelled"} onClick={() => goCue(cue)}>{cue.status === "failed" ? "Retry" : "GO"}</button>{cue.status === "complete" && <button onClick={() => goCue(cue, true)}>Re-run</button>}</div>)}
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
        <button onClick={sendCommand}>Send configurable command</button><button disabled={!rundownId} onClick={addCue}>Save as rundown cue</button>
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
    <section className="section"><h2>Live dispatch status</h2>
      {outbox.length === 0 ? <p className="empty">No durable commands have been submitted.</p> : <table className="events-table"><thead><tr><th>Command</th><th>Revision</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {outbox.map((item) => <tr key={item.id}><td>{item.label}<br /><span className="hint mono">{item.eventId}</span>{item.error && <p className="error-msg">{item.error}</p>}</td><td>{item.revision}</td><td>{item.status}</td><td>{item.retryable && <button onClick={() => resolveOutbox(item, "retry")}>Retry</button>}{item.cancellable && <button className="safe-clear" onClick={() => resolveOutbox(item, "cancel")}>Cancel</button>}</td></tr>)}
      </tbody></table>}
    </section>
  </div>;
}
