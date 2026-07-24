import type { useShowConfiguration } from "../hooks/useShowConfiguration.js";
import type { useRundownEditor } from "../hooks/useRundownEditor.js";
import type { useCommandBuilder } from "../hooks/useCommandBuilder.js";
import { useAdminState } from "./AdminStateContext.js";
import { ThreeColumnWorkspace } from "./layout/ThreeColumnWorkspace.js";
import { WorkspacePanel } from "./ui/WorkspacePanel.js";
import { CueList, CueListItem } from "./ui/CueList.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";
import { ProfileSelector } from "./ui/ProfileSelector.js";
import { PlayerPreview } from "./ui/PlayerPreview.js";

interface Props {
  rundownEditor: ReturnType<typeof useRundownEditor>;
  commandBuilder: ReturnType<typeof useCommandBuilder>;
  setRundownId: (id: string) => void;
  refreshRundowns: () => Promise<void>;
  previewProfile: "desktop" | "mobile" | "tv";
  setPreviewProfile: (p: "desktop" | "mobile" | "tv") => void;
  layoutPreviewUrl: string;
}

export function RundownWorkspace({ rundownEditor, commandBuilder, setRundownId, refreshRundowns, previewProfile, setPreviewProfile, layoutPreviewUrl }: Props) {
  const { productionId, rundownId, mutate } = useAdminState();

  const left = (
    <WorkspacePanel heading="Rundown editor">
      <div className="form" style={{ marginBottom: 14 }}>
        <label>
          <span>Rundown name</span>
          <input
            value={rundownEditor.rundownName}
            onChange={(event) => rundownEditor.setRundownName(event.target.value)}
          />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <PrimaryAction
            disabled={!productionId}
            onClick={async () => {
              const result = await mutate(
                `/api/productions/${productionId}/rundowns`,
                "POST",
                { name: rundownEditor.rundownName || "New rundown" },
                "Rundown created"
              );
              if (result?.id) {
                await refreshRundowns();
                setRundownId(result.id);
              }
            }}
          >
            Create rundown
          </PrimaryAction>
          <PrimaryAction
            disabled={!rundownId}
            onClick={() => mutate(
              `/api/rundowns/${rundownId}`,
              "PUT",
              { name: rundownEditor.rundownName },
              "Rundown saved",
              rundownEditor.reloadRundownDefinition
            )}
          >
            Save rundown
          </PrimaryAction>
          <SecondaryAction
            disabled={!rundownId}
            onClick={async () => {
              const result = await mutate(
                `/api/rundowns/${rundownId}/duplicate`,
                "POST",
                {},
                "Rundown duplicated"
              );
              if (result?.id) {
                await refreshRundowns();
                setRundownId(result.id);
              }
            }}
          >
            Duplicate
          </SecondaryAction>
        </div>
      </div>

      <CueList heading="Cue list" ariaLabel="Rundown cues">
        {rundownEditor.rundownDefinition.map((cue, index) => (
          <CueListItem
            key={cue.id}
            order={cue.position}
            label={cue.label}
            status={cue.enabled ? "enabled" : "disabled"}
            enabled={cue.enabled}
            actions={
              <>
                <button onClick={() => rundownEditor.editCue(cue, { enabled: !cue.enabled })}>
                  {cue.enabled ? "Disable" : "Enable"}
                </button>
                <button disabled={index === 0} onClick={() => rundownEditor.moveCue(index, -1)}>
                  ↑
                </button>
                <button disabled={index === rundownEditor.rundownDefinition.length - 1} onClick={() => rundownEditor.moveCue(index, 1)}>
                  ↓
                </button>
              </>
            }
          />
        ))}
      </CueList>
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Command builder" variant="control">
      <p className="hint" style={{ marginBottom: 12 }}>
        The typed command form can send immediately or save a new cue into this rundown.
      </p>
      <div className="form">
        <label>
          <span>Action</span>
          <select
            value={commandBuilder.commandKind}
            onChange={(event) => {
              commandBuilder.setCommandKind(event.target.value);
              commandBuilder.setPrimary("");
              commandBuilder.setSecondary("");
              commandBuilder.setLabel("");
            }}
          >
            <option value="score">Score update</option>
            <option value="lower">Lower third</option>
            <option value="alert">Alert</option>
            <option value="sponsor">Sponsor takeover</option>
            <option value="ticker">Ticker update</option>
            <option value="clock">Programme clock</option>
            <option value="clear">Regional clear</option>
          </select>
        </label>

        {commandBuilder.commandKind !== "clear" && (
          <label>
            <span>Presentation instance (optional)</span>
            <input
              value={commandBuilder.commandInstanceId}
              maxLength={24}
              pattern="[A-Za-z0-9][A-Za-z0-9-]*"
              onChange={(event) => commandBuilder.setCommandInstanceId(event.target.value)}
              placeholder="scorebug-main"
            />
          </label>
        )}

        {commandBuilder.commandKind === "score" ? (
          <>
            <label>
              <span>Home score</span>
              <input type="number" min={0} max={999} value={commandBuilder.primary} onChange={(event) => commandBuilder.setPrimary(event.target.value)} />
            </label>
            <label>
              <span>Away score</span>
              <input type="number" min={0} max={999} value={commandBuilder.secondary} onChange={(event) => commandBuilder.setSecondary(event.target.value)} />
            </label>
            <label>
              <span>Label</span>
              <input value={commandBuilder.label} maxLength={12} onChange={(event) => commandBuilder.setLabel(event.target.value)} placeholder="GOAL" />
            </label>
          </>
        ) : commandBuilder.commandKind === "clear" ? (
          <>
            <label>
              <span>Region</span>
              <select value={commandBuilder.primary} onChange={(event) => commandBuilder.setPrimary(event.target.value)}>
                <option value="">All regions</option>
                <option value="v">Video overlay</option>
                <option value="h">Header</option>
                <option value="l">Left rail</option>
                <option value="r">Right rail</option>
                <option value="f">Footer</option>
              </select>
            </label>
            <label>
              <span>Layer (optional)</span>
              <input value={commandBuilder.secondary} maxLength={16} onChange={(event) => commandBuilder.setSecondary(event.target.value)} placeholder="primary" />
            </label>
          </>
        ) : commandBuilder.commandKind === "clock" ? (
          <>
            <label>
              <span>Clock time</span>
              <input value={commandBuilder.primary} maxLength={12} onChange={(event) => commandBuilder.setPrimary(event.target.value)} placeholder="78:42" />
            </label>
            <label>
              <span>Clock label</span>
              <input value={commandBuilder.label} maxLength={12} onChange={(event) => commandBuilder.setLabel(event.target.value)} placeholder="LIVE" />
            </label>
          </>
        ) : (
          <>
            <label>
              <span>{commandBuilder.commandKind === "sponsor" ? "Brand" : commandBuilder.commandKind === "ticker" ? "Ticker text" : "Title"}</span>
              <input value={commandBuilder.primary} maxLength={20} onChange={(event) => commandBuilder.setPrimary(event.target.value)} />
            </label>
            {commandBuilder.commandKind !== "ticker" && (
              <label>
                <span>{commandBuilder.commandKind === "alert" ? "Message" : "Subtitle / tagline"}</span>
                <input value={commandBuilder.secondary} maxLength={20} onChange={(event) => commandBuilder.setSecondary(event.target.value)} />
              </label>
            )}
            {commandBuilder.commandKind === "ticker" && (
              <label>
                <span>Label</span>
                <input value={commandBuilder.label} maxLength={12} onChange={(event) => commandBuilder.setLabel(event.target.value)} />
              </label>
            )}
            {commandBuilder.commandKind !== "ticker" && (
              <label>
                <span>Duration (ms)</span>
                <input type="number" min={1000} step={1000} value={commandBuilder.commandDuration} onChange={(event) => commandBuilder.setCommandDuration(Number(event.target.value))} />
              </label>
            )}
          </>
        )}
      </div>
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Placement preview" variant="preview">
      <ProfileSelector
        profiles={["desktop", "mobile", "tv"]}
        selected={previewProfile}
        onSelect={(p) => setPreviewProfile(p as "desktop" | "mobile" | "tv")}
        label="Placement preview profile"
      />
      <PlayerPreview
        url={layoutPreviewUrl}
        title={`Placement Player ${previewProfile} preview`}
        profile={previewProfile}
      />
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
