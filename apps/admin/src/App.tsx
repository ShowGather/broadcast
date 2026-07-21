import { useEffect, useState, useCallback } from "react";

interface StoredEvent {
  event: {
    id: string;
    p: { title: string; msg?: string; dur: number };
  };
  injectedAt: string;
}

interface HealthStatus {
  status: string;
  uptime?: number;
}

function App() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(5000);
  const [injectStatus, setInjectStatus] = useState("");
  const [injectError, setInjectError] = useState("");
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [pipeline, setPipeline] = useState<HealthStatus | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPipeline(data);
      setInjectError("");
    } catch {
      setPipeline(null);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      // keep existing events
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchEvents();
    const interval = setInterval(() => {
      fetchHealth();
      fetchEvents();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchEvents]);

  const handleInject = async () => {
    if (!title.trim()) {
      setInjectError("Title is required");
      return;
    }
    setInjectStatus("");
    setInjectError("");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim() || undefined,
          durationMs: duration,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const eventId = data.event?.id ?? "unknown";
      const injectedAt = data.injectedAt ?? "";
      setInjectStatus(
        `Injected: ${eventId} at ${injectedAt}`
      );
      setTitle("");
      setMessage("");
      setDuration(5000);
      fetchEvents();
    } catch (err: unknown) {
      setInjectError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const connected = pipeline?.status === "ok" || pipeline?.status === "healthy";

  return (
    <div className="container">
      <header className="header">
        <h1>ShowGather Broadcast &mdash; Admin</h1>
      </header>

      <div className="pipeline-status">
        <span className={`dot ${connected ? "connected" : "disconnected"}`} />
        <span>
          Pipeline Status:{" "}
          {connected
            ? "Connected"
            : pipeline
            ? `Disconnected (${pipeline.status})`
            : "Disconnected"}
        </span>
      </div>

      <section className="section">
        <h2>Inject Overlay</h2>
        <div className="form">
          <label>
            <span>Title:</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Goal!"
            />
          </label>
          <label>
            <span>Message: (optional)</span>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. 1-0"
            />
          </label>
          <label>
            <span>Duration (ms):</span>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={1000}
              step={1000}
            />
          </label>
          <button onClick={handleInject}>
            Inject Overlay
          </button>
        </div>

        {injectStatus && <p className="status-msg">{injectStatus}</p>}
        {injectError && <p className="error-msg">Error: {injectError}</p>}
      </section>

      <section className="section">
        <h2>Event History</h2>
        {events.length === 0 ? (
          <p className="empty">No events yet.</p>
        ) : (
          <table className="events-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Duration</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((stored) => (
                <tr key={stored.event.id}>
                  <td className="mono">{stored.event.id}</td>
                  <td>{stored.event.p.title}</td>
                  <td>{stored.event.p.dur}ms</td>
                  <td className="mono">
                    {new Date(stored.injectedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default App;
