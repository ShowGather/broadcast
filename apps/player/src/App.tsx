import { useRef } from "react";
import { useSyncClient } from "./useSyncClient";

function deltaClass(delta: number | null): string {
  if (delta === null) return "pending";
  const abs = Math.abs(delta);
  if (abs < 50) return "green";
  if (abs < 200) return "yellow";
  return "red";
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { overlays, syncLog, status } = useSyncClient(videoRef);

  return (
    <div className="app">
      <header className="app-header">
        <h1>ShowGather Player</h1>
        <span className="status">{status}</span>
      </header>

      <div className="main-content">
        <div className="video-container">
          <video
            ref={videoRef}
            controls
            autoPlay
            muted
            className="video-player"
          />

          {overlays.map((o) => (
            <div
              key={o.event.id}
              className="overlay"
              style={{ opacity: 1 }}
            >
              <div className="overlay-title">{o.event.p.title}</div>
              {o.event.p.msg && (
                <div className="overlay-msg">{o.event.p.msg}</div>
              )}
            </div>
          ))}
        </div>

        <div className="sync-log">
          <h2>Sync Log</h2>
          <table>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>PTS (s)</th>
                <th>Video @render</th>
                <th>Delta (ms)</th>
              </tr>
            </thead>
            <tbody>
              {syncLog.map((entry) => (
                <tr key={entry.eventId} className={deltaClass(entry.deltaMs)}>
                  <td className="mono">{entry.eventId}</td>
                  <td className="mono">{entry.metadataPts.toFixed(3)}</td>
                  <td className="mono">
                    {entry.videoTimeAtRender !== null
                      ? entry.videoTimeAtRender.toFixed(3)
                      : "—"}
                  </td>
                  <td className="mono">
                    {entry.deltaMs !== null ? entry.deltaMs.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
              {syncLog.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    Waiting for events...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
