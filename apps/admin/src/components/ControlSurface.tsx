import type { useShowConfiguration } from "../hooks/useShowConfiguration.js";
import type { useCommandBuilder } from "../hooks/useCommandBuilder.js";
import { useAdminState } from "./AdminStateContext.js";

interface Props {
  commandBuilder: ReturnType<typeof useCommandBuilder>;
  showConfig: ReturnType<typeof useShowConfiguration>;
  rehearsal: boolean;
  workspace: string;
  prepareTab: string;
  sendCommand: () => void;
  addCue: () => void;
}

export function ControlSurface({ commandBuilder, showConfig, rehearsal, workspace, prepareTab, sendCommand, addCue }: Props) {
  const { rundownId, send } = useAdminState();
  return <section className="section control-surface" hidden={workspace === "prepare" && prepareTab !== "rundown"}>
    <div className="workspace-heading"><div><h2>Control Surface</h2><p className="hint">Typed controls follow the selected presentation element, or can remain pinned while you work elsewhere.</p></div><div className="control-surface__mode" role="group" aria-label="Control Surface mode"><button type="button" className={!showConfig.deckPinned ? "active" : ""} onClick={() => showConfig.setDeckPinned(false)}>Follow selected cue</button><button type="button" className={showConfig.deckPinned ? "active" : ""} onClick={() => showConfig.setDeckPinned(true)}>Pinned controls</button></div></div>
    <div className="form">
      <label><span>Action</span><select value={commandBuilder.commandKind} onChange={(event) => { commandBuilder.setCommandKind(event.target.value); commandBuilder.setPrimary(""); commandBuilder.setSecondary(""); commandBuilder.setLabel(""); }}>
        <option value="score">Score update</option><option value="lower">Lower third</option><option value="alert">Alert</option><option value="sponsor">Sponsor takeover</option><option value="ticker">Ticker update</option><option value="clock">Programme clock</option><option value="clear">Regional clear</option>
      </select></label>
      {commandBuilder.commandKind !== "clear" && <label><span>Presentation instance (optional)</span><input value={commandBuilder.commandInstanceId} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9-]*" onChange={(event) => commandBuilder.setCommandInstanceId(event.target.value)} placeholder="scorebug-main" /></label>}
      {commandBuilder.commandKind === "score" ? <><label><span>Home score</span><input type="number" min={0} max={999} value={commandBuilder.primary} onChange={(event) => commandBuilder.setPrimary(event.target.value)} /></label><label><span>Away score</span><input type="number" min={0} max={999} value={commandBuilder.secondary} onChange={(event) => commandBuilder.setSecondary(event.target.value)} /></label><label><span>Label</span><input value={commandBuilder.label} maxLength={12} onChange={(event) => commandBuilder.setLabel(event.target.value)} placeholder="GOAL" /></label></>
        : commandBuilder.commandKind === "clear" ? <><label><span>Region</span><select value={commandBuilder.primary} onChange={(event) => commandBuilder.setPrimary(event.target.value)}><option value="">All regions</option><option value="v">Video overlay</option><option value="h">Header</option><option value="l">Left rail</option><option value="r">Right rail</option><option value="f">Footer</option></select></label><label><span>Layer (optional)</span><input value={commandBuilder.secondary} maxLength={16} onChange={(event) => commandBuilder.setSecondary(event.target.value)} placeholder="primary" /></label></>
        : commandBuilder.commandKind === "clock" ? <><label><span>Clock time</span><input value={commandBuilder.primary} maxLength={12} onChange={(event) => commandBuilder.setPrimary(event.target.value)} placeholder="78:42" /></label><label><span>Clock label</span><input value={commandBuilder.label} maxLength={12} onChange={(event) => commandBuilder.setLabel(event.target.value)} placeholder="LIVE" /></label></>
        : <><label><span>{commandBuilder.commandKind === "sponsor" ? "Brand" : commandBuilder.commandKind === "ticker" ? "Ticker text" : "Title"}</span><input value={commandBuilder.primary} maxLength={20} onChange={(event) => commandBuilder.setPrimary(event.target.value)} /></label>{commandBuilder.commandKind !== "ticker" && <label><span>{commandBuilder.commandKind === "alert" ? "Message" : "Subtitle / tagline"}</span><input value={commandBuilder.secondary} maxLength={20} onChange={(event) => commandBuilder.setSecondary(event.target.value)} /></label>}{commandBuilder.commandKind === "ticker" && <label><span>Label</span><input value={commandBuilder.label} maxLength={12} onChange={(event) => commandBuilder.setLabel(event.target.value)} /></label>}{commandBuilder.commandKind !== "ticker" && <label><span>Duration (ms)</span><input type="number" min={1000} step={1000} value={commandBuilder.commandDuration} onChange={(event) => commandBuilder.setCommandDuration(Number(event.target.value))} /></label>}</>}
      <button onClick={sendCommand}>{rehearsal ? "Trigger rehearsal command" : "Send configurable command"}</button>{workspace === "prepare" && <button disabled={!rundownId} onClick={addCue}>Save as rundown cue</button>}
    </div>
    {rehearsal && <div className="control-surface__macros" aria-label="Rehearsal macro bank"><span>Macro bank</span><button onClick={() => send({ cue: "goal-home", durationMs: 15_000 }, "Home Goal macro sent")}>Home Goal</button><button onClick={() => send({ cue: "speaker-intro", durationMs: 8_000 }, "Lower Third macro sent")}>Lower Third</button><button onClick={() => send({ cue: "alert-test", durationMs: 8_000 }, "Alert macro sent")}>Alert</button><button className="safe-clear" onClick={() => send({ action: "safe-clear" }, "Safe Clear macro sent")}>Safe Clear</button></div>}
    <p className="hint">Text is byte-bounded for the compact timed-ID3 envelope. Score, ticker, persistent sponsor, and clear update the late-join snapshot.</p>
  </section>;
}
