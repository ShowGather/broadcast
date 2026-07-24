import type { RundownCue, OutboxItem } from "../types.js";
import type { useRunWorkspace } from "../hooks/useRunWorkspace.js";
import { useAdminState } from "./AdminStateContext.js";
import { ThreeColumnWorkspace } from "./layout/ThreeColumnWorkspace.js";
import { WorkspacePanel } from "./ui/WorkspacePanel.js";
import { CueList, CueListItem } from "./ui/CueList.js";
import { StatusBadge } from "./ui/StatusBadge.js";
import { PrimaryAction, SecondaryAction, DangerAction, SafetyAction } from "./ui/ActionButtons.js";
import { PlayerPreview } from "./ui/PlayerPreview.js";
import { ValidationMessage } from "./ui/ValidationMessage.js";

interface Props {
  rundowns: { id: string; name: string }[];
  rundown: RundownCue[];
  selectedProduction: { title?: string } | undefined;
  disabledCueCount: number;
  apiConnection: string;
  streamConnection: string;
  sessionId: string;
  unresolvedOutbox: OutboxItem[];
  programmePreviewUrl: string;
  runWorkspace: ReturnType<typeof useRunWorkspace>;
  setDiagnosticsOpen: (open: boolean) => void;
}

export function RunWorkspaceSection({ rundowns, rundown, selectedProduction, disabledCueCount, apiConnection, streamConnection, sessionId, unresolvedOutbox, programmePreviewUrl, runWorkspace, setDiagnosticsOpen }: Props) {
  const { rundownId } = useAdminState();

  if (!runWorkspace.runReady) {
    return (
      <section className="section run-entry" aria-labelledby="run-entry-title">
        <h2 id="run-entry-title">Confirm live operation</h2>
        <p className="hint">Entering this workspace does not put the programme live. Review the current operational state, then explicitly start or resume the live session.</p>
        <dl className="run-entry__summary">
          <div><dt>Production</dt><dd>{selectedProduction?.title ?? "Not selected"}</dd></div>
          <div><dt>Rundown</dt><dd>{rundowns.find((item) => item.id === rundownId)?.name ?? "Not selected"}</dd></div>
          <div><dt>Cues</dt><dd>{rundown.length} total · {disabledCueCount} disabled</dd></div>
          <div><dt>Connection</dt><dd>API {apiConnection} · Stream {streamConnection}</dd></div>
          <div><dt>Live session</dt><dd>{sessionId ? "Existing session can be resumed" : "No active session"}</dd></div>
          <div><dt>Dispatch issues</dt><dd>{unresolvedOutbox.length ? `${unresolvedOutbox.length} pending or failed` : "None"}</dd></div>
        </dl>
        {unresolvedOutbox.length > 0 && (
          <ValidationMessage
            type="error"
            message="Resolve or acknowledge the listed dispatch issues before operating live. Retry and Cancel remain available below."
          />
        )}
        <PrimaryAction
          className="run-entry__go"
          disabled={!rundownId || apiConnection !== "connected" || streamConnection !== "connected"}
          onClick={runWorkspace.enterRun}
        >
          {sessionId ? "Resume live session" : "Start live session"}
        </PrimaryAction>
      </section>
    );
  }

  const left = (
    <WorkspacePanel heading="Cue stack">
      <CueList heading="Complete rundown" ariaLabel="Live cue stack">
        {rundown.map((cue, index) => (
          <CueListItem
            key={cue.id}
            order={cue.order}
            label={cue.label}
            status={cue.status}
            enabled={cue.enabled}
            active={index === runWorkspace.runCueIndex}
            onSelect={() => runWorkspace.setRunCueIndex(index)}
            disabled={!cue.enabled}
          />
        ))}
      </CueList>
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Programme preview" variant="run">
      <div style={{ marginBottom: 12 }}>
        <StatusBadge status={sessionId ? "active" : "draft"} label={sessionId ? "Session active" : "No session"} />
      </div>
      <PlayerPreview
        url={programmePreviewUrl}
        title="Programme Player preview"
        profile="desktop"
      />
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Live control" variant="run">
      {unresolvedOutbox.length > 0 && (
        <ValidationMessage
          type="error"
          message={`${unresolvedOutbox.length} pending or failed durable command${unresolvedOutbox.length === 1 ? "" : "s"} must be resolved before later live cues can be sent.`}
        />
      )}

      <div style={{ marginTop: 14 }}>
        <h3 style={{ color: "#e69494", fontSize: ".72rem", fontWeight: 750, letterSpacing: ".08em", textTransform: "uppercase" }}>
          Current cue
        </h3>
        <p style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 750, marginTop: 4 }}>
          {runWorkspace.runCue?.label ?? "No enabled cue remaining"}
        </p>
        <p style={{ color: "#bdc6d4", fontSize: ".86rem", marginTop: 2 }}>
          {runWorkspace.runCue
            ? `${runWorkspace.runCue.order}. ${runWorkspace.runCue.status}`
            : "The rundown is complete or has no enabled cues."}
        </p>
      </div>

      {runWorkspace.nextRunCue && (
        <div style={{ marginTop: 12 }}>
          <span style={{ color: "#e69494", fontSize: ".72rem", fontWeight: 750, letterSpacing: ".08em", textTransform: "uppercase" }}>Next</span>
          <p style={{ color: "#edf4ff", fontSize: ".86rem", marginTop: 4 }}>{runWorkspace.nextRunCue.label}</p>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <SecondaryAction
          disabled={runWorkspace.runCueIndex === 0}
          onClick={() => runWorkspace.setRunCueIndex((index) => Math.max(0, index - 1))}
        >
          Previous
        </SecondaryAction>

        <PrimaryAction
          className="action-btn--go"
          disabled={unresolvedOutbox.length > 0 || !runWorkspace.runCue || !runWorkspace.runCue.enabled || runWorkspace.runCue.status === "active" || runWorkspace.runCue.status === "cancelled"}
          onClick={() => {
            if (runWorkspace.runCue) runWorkspace.goCue(runWorkspace.runCue);
          }}
        >
          {unresolvedOutbox.length > 0 ? "Resolve delivery issue" : runWorkspace.runCue?.status === "failed" ? "Retry cue" : "GO"}
        </PrimaryAction>

        <SafetyAction onClick={() => runWorkspace.setConfirmation("safe-clear")}>
          Safe Clear
        </SafetyAction>
      </div>

      <div style={{ marginTop: 16, borderTop: "1px solid #4c2930", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <SecondaryAction onClick={() => runWorkspace.setConfirmation("complete")}>
          Complete show
        </SecondaryAction>
        <DangerAction onClick={() => runWorkspace.setConfirmation("abandon")}>
          Abandon session
        </DangerAction>
        <SecondaryAction onClick={() => runWorkspace.setConfirmation("reset")}>
          Reset live session
        </SecondaryAction>
      </div>
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} wideCentre />;
}

export function ConfirmationDialog({ runWorkspace }: { runWorkspace: ReturnType<typeof useRunWorkspace> }) {
  if (!runWorkspace.confirmation) return null;
  return <div className="confirmation-backdrop" role="presentation"><section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description"><h2 id="confirmation-title">{runWorkspace.confirmation === "complete" ? "Complete this live show?" : runWorkspace.confirmation === "abandon" ? "Abandon this live session?" : runWorkspace.confirmation === "safe-clear" ? "Confirm Safe Clear?" : "Start a new live session?"}</h2><p id="confirmation-description">{runWorkspace.confirmation === "complete" ? "The current session will be marked complete. Programme presentation is not cleared automatically." : runWorkspace.confirmation === "abandon" ? "The current session will be recorded as abandoned. Programme presentation is not cleared automatically." : runWorkspace.confirmation === "safe-clear" ? "Safe Clear removes active presentation graphics. Programme video will continue uninterrupted." : "The current live session will be completed and a fresh immutable rundown session will begin."}</p><div><button onClick={() => runWorkspace.setConfirmation(null)}>Cancel</button><button ref={runWorkspace.confirmationButton} className="danger" onClick={runWorkspace.confirmSessionAction}>{runWorkspace.confirmation === "safe-clear" ? "Confirm Safe Clear" : "Confirm"}</button></div></section></div>;
}
