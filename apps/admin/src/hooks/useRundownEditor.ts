import { useCallback, useEffect, useState } from "react";
import type { RundownDefinitionCue } from "../types.js";

interface Params {
  rundownId: string;
  mutate: (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => Promise<{ id?: string } | undefined>;
  fetchRundown: () => Promise<void>;
  currentCommand: () => Record<string, unknown>;
}

export function useRundownEditor({ rundownId, mutate, fetchRundown, currentCommand }: Params) {
  const [rundownName, setRundownName] = useState("");
  const [rundownDefinition, setRundownDefinition] = useState<RundownDefinitionCue[]>([]);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);

  const reloadRundownDefinition = useCallback(async () => {
    if (!rundownId) return;
    const response = await fetch(`/api/rundowns/${rundownId}`);
    if (!response.ok) throw new Error("Unable to load rundown editor");
    const item = await response.json() as { name: string; cues: RundownDefinitionCue[] };
    setRundownName(item.name); setRundownDefinition(item.cues);
    setSelectedCueId((current) => item.cues.some((cue) => cue.id === current) ? current : null);
  }, [rundownId]);

  useEffect(() => { reloadRundownDefinition().catch(() => {}); }, [reloadRundownDefinition]);
  useEffect(() => { setSelectedCueId(null); }, [rundownId]);

  const addCue = useCallback(async () => {
    await mutate(`/api/rundowns/${rundownId}/cues`, "POST", { label: currentCommand().l || `${currentCommand().k} cue`, command: currentCommand(), enabled: true }, "Cue saved", async () => { await reloadRundownDefinition(); await fetchRundown(); });
  }, [rundownId, mutate, currentCommand, reloadRundownDefinition, fetchRundown]);

  const duplicateCue = useCallback(async (cue: RundownDefinitionCue) => {
    const result = await mutate(
      `/api/rundowns/${rundownId}/cues`,
      "POST",
      { label: `${cue.label} (Copy)`, command: cue.commandPayload, enabled: cue.enabled },
      "Cue duplicated",
      async () => { await reloadRundownDefinition(); await fetchRundown(); }
    );
    if (result?.id) setSelectedCueId(result.id);
  }, [rundownId, mutate, reloadRundownDefinition, fetchRundown]);

  const editCue = useCallback(async (cue: RundownDefinitionCue, changes: Record<string, unknown>) => {
    await mutate(`/api/rundown-cues/${cue.id}`, "PUT", changes, "Cue updated", async () => { await reloadRundownDefinition(); await fetchRundown(); });
  }, [mutate, reloadRundownDefinition, fetchRundown]);

  const moveCue = useCallback(async (index: number, direction: -1 | 1) => {
    const reordered = [...rundownDefinition]; const next = index + direction; if (next < 0 || next >= reordered.length) return;
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    await mutate(`/api/rundowns/${rundownId}/cues/reorder`, "POST", { cueIds: reordered.map((cue) => cue.id) }, "Cue order saved", reloadRundownDefinition);
  }, [rundownId, rundownDefinition, mutate, reloadRundownDefinition]);

  return {
    rundownName, setRundownName,
    rundownDefinition,
    selectedCueId, setSelectedCueId,
    reloadRundownDefinition,
    addCue,
    duplicateCue,
    editCue,
    moveCue,
  } as const;
}
