import type { RundownCue } from "../types.js";
import type { useRunWorkspace } from "../hooks/useRunWorkspace.js";
import { useState } from "react";
import { useAdminState } from "./AdminStateContext.js";
import { ThreeColumnWorkspace } from "./layout/ThreeColumnWorkspace.js";
import { WorkspacePanel } from "./ui/WorkspacePanel.js";
import { CueList, CueListItem } from "./ui/CueList.js";
import { ProfileSelector } from "./ui/ProfileSelector.js";
import { PrimaryAction, SecondaryAction, SafetyAction } from "./ui/ActionButtons.js";
import { PlayerPreview } from "./ui/PlayerPreview.js";

interface Props {
  playerPreviewUrl: string;
  previewProfile: "desktop" | "mobile" | "tv";
  setPreviewProfile: (p: "desktop" | "mobile" | "tv") => void;
  rundowns: { id: string; name: string }[];
  rundown: RundownCue[];
  rehearsal: boolean;
  runWorkspace: ReturnType<typeof useRunWorkspace>;
  fetchRundown: () => Promise<void>;
}

export function RehearseWorkspace({ playerPreviewUrl, previewProfile, setPreviewProfile, rundowns, rundown, rehearsal, runWorkspace, fetchRundown }: Props) {
  const { rundownId, send, mutate, navigate, productionId } = useAdminState();
  const [selectedCueIndex, setSelectedCueIndex] = useState<number | null>(null);

  const selectedCue = selectedCueIndex !== null ? rundown[selectedCueIndex] : null;
  const currentIndex = rundown.findIndex((cue) => cue.status === "active");
  const currentCue = currentIndex >= 0 ? rundown[currentIndex] : null;
  const nextCue = currentIndex >= 0 ? rundown[currentIndex + 1] : null;

  const left = (
    <WorkspacePanel heading="Rehearsal rundown">
      <ProfileSelector
        profiles={["desktop", "mobile", "tv"]}
        selected={previewProfile}
        onSelect={(p) => setPreviewProfile(p as "desktop" | "mobile" | "tv")}
        label="Preview profile"
      />

      <div style={{ marginTop: 14 }}>
        <PrimaryAction
          disabled={!rundownId}
          onClick={() => mutate(
            `/api/rundown/${rehearsal ? "rehearsal" : "live"}/sessions?rundownId=${encodeURIComponent(rundownId)}`,
            "POST",
            {},
            `${rehearsal ? "Rehearsal" : "Live"} session started`,
            fetchRundown
          )}
        >
          {rehearsal ? "Reset rehearsal session" : "Start new live session"}
        </PrimaryAction>
      </div>

      <div style={{ marginTop: 14 }}>
        <CueList heading="Cue list" ariaLabel="Rehearsal cues">
          {rundown.map((cue, index) => (
            <CueListItem
              key={cue.id}
              order={cue.order}
              label={cue.label}
              status={cue.status}
              enabled={cue.enabled}
              active={selectedCueIndex === index}
              onSelect={() => setSelectedCueIndex(index)}
              actions={
                <button
                  disabled={cue.status === "active" || cue.status === "cancelled"}
                  onClick={(e) => { e.stopPropagation(); runWorkspace.goCue(cue); }}
                >
                  {cue.status === "failed" ? "Retry" : "GO"}
                </button>
              }
            />
          ))}
        </CueList>
      </div>
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Rehearsal preview" variant="rehearse">
      <p className="hint" style={{ marginBottom: 12 }}>
        This embeds the real Player in rehearsal mode. It never sends rehearsal cues to the live stream.
      </p>
      <PlayerPreview
        url={playerPreviewUrl}
        title={`Rehearsal Player ${previewProfile} preview`}
        profile={previewProfile}
      />
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Cue control" variant="rehearse">
      {selectedCue ? (
        <>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ color: "#ffe2a2", fontSize: ".78rem", fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase" }}>
              Selected cue
            </h3>
            <p style={{ color: "#e6cea0", fontSize: ".86rem", marginTop: 4 }}>
              {selectedCue.order}. {selectedCue.label}
            </p>
            <p style={{ color: "#aebbd0", fontSize: ".78rem", marginTop: 2 }}>
              Status: {selectedCue.status}
            </p>
          </div>

          <PrimaryAction
            disabled={selectedCue.status === "active" || selectedCue.status === "cancelled"}
            onClick={() => runWorkspace.goCue(selectedCue)}
          >
            GO IN REHEARSAL
          </PrimaryAction>

          {selectedCue.status === "complete" && (
            <SecondaryAction
              onClick={() => runWorkspace.goCue(selectedCue, true)}
              style={{ marginTop: 8 }}
            >
              Re-run in rehearsal
            </SecondaryAction>
          )}
        </>
      ) : currentCue ? (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ color: "#ffe2a2", fontSize: ".78rem", fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase" }}>
            Current cue
          </h3>
          <p style={{ color: "#e6cea0", fontSize: ".86rem", marginTop: 4 }}>
            {currentCue.order}. {currentCue.label}
          </p>
          {nextCue && (
            <div style={{ marginTop: 8 }}>
              <span style={{ color: "#ffe2a2", fontSize: ".72rem", fontWeight: 750, letterSpacing: ".08em", textTransform: "uppercase" }}>Next</span>
              <p style={{ color: "#e6cea0", fontSize: ".86rem", marginTop: 2 }}>{nextCue.order}. {nextCue.label}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="hint">Select a cue from the list to view its details and controls.</p>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <SecondaryAction onClick={() => navigate({ workspace: "prepare", productionId })}>
          Return to Prepare
        </SecondaryAction>
        <PrimaryAction onClick={() => navigate({ workspace: "run", productionId })}>
          Proceed to Run
        </PrimaryAction>
      </div>

      <SafetyAction
        onClick={() => send({ action: "safe-clear" }, "Safe Clear sent")}
        style={{ marginTop: 16 }}
      >
        Safe Clear
      </SafetyAction>
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
