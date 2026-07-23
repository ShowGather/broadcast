interface Props {
  title: string;
  setTitle: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  send: (payload: Record<string, unknown>, statusMessage: string) => void;
}

export function LegacyOverlay({ title, setTitle, message, setMessage, duration, setDuration, send }: Props) {
  return <section className="section legacy-overlay">
    <h2>Custom legacy overlay</h2>
    <div className="form">
      <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Goal!" /></label>
      <label><span>Message</span><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="e.g. 1\u20130" /></label>
      <label><span>Duration (ms)</span><input type="number" min={1000} step={1000} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
      <button onClick={() => send({ title: title.trim(), message: message.trim() || undefined, durationMs: duration }, "Overlay sent")}>Send Overlay</button>
    </div>
  </section>;
}
