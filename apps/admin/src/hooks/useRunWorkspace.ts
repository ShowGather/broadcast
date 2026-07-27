import { useCallback, useEffect, useRef, useState } from "react";
import type { RundownCue } from "../types.js";

interface Params {
  rundownId: string;
  rundown: RundownCue[];
  sessionId: string;
  rehearsal: boolean;
  send: (body: Record<string, unknown>, success: string) => Promise<void>;
  mutate: (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => Promise<{ id?: string } | undefined>;
  fetchRundown: () => Promise<void>;
  fetchEvents: () => Promise<void>;
  fetchOutbox: () => Promise<void>;
  workspace: string;
}

export function useRunWorkspace({ rundownId, rundown, sessionId, rehearsal, send, mutate, fetchRundown, fetchEvents, fetchOutbox, workspace }: Params) {
  const [runReady, setRunReady] = useState(false);
  const [runCueIndex, setRunCueIndex] = useState(0);
  const [confirmation, setConfirmation] = useState<"complete" | "abandon" | "reset" | "safe-clear" | null>(null);
  const confirmationButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (workspace !== "run") setRunReady(false); }, [workspace]);
  useEffect(() => { if (confirmation) confirmationButton.current?.focus(); }, [confirmation]);
  useEffect(() => {
    setRunCueIndex((current) => {
      const firstPending = rundown.findIndex((cue) => cue.enabled && cue.status === "pending");
      if (firstPending >= 0 && (current >= rundown.length || rundown[current]?.status === "complete")) return firstPending;
      return Math.max(0, Math.min(current, Math.max(0, rundown.length - 1)));
    });
  }, [rundown]);

  const goCue = useCallback(async (cue: RundownCue, rerun = false) => {
    try {
      const response = await fetch(`/api/rundown/${rehearsal ? "rehearsal" : "live"}/go?rundownId=${encodeURIComponent(rundownId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cueId: cue.id, ...(rerun ? { rerun: true } : {}) }) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      await fetchRundown();
      if (!rehearsal) { fetchEvents(); fetchOutbox(); }
      return { success: `${rehearsal ? "Rehearsal" : "Live"} rundown: ${cue.label} ${result.dispatchStatus ?? "complete"}` };
    } catch (reason) { return { error: reason instanceof Error ? reason.message : "Unable to execute cue" }; }
  }, [rehearsal, rundownId, fetchRundown, fetchEvents, fetchOutbox]);

  const enterRun = useCallback(async () => {
    if (sessionId) { setRunReady(true); return { status: "Resumed the existing live session." }; }
    const result = await mutate(`/api/rundown/live/sessions?rundownId=${encodeURIComponent(rundownId)}`, "POST", {}, "Live session started", fetchRundown);
    if (result) { setRunReady(true); return { status: "Live session started." }; }
    return undefined;
  }, [sessionId, mutate, rundownId, fetchRundown]);

  const confirmSessionAction = useCallback(async () => {
    if (!confirmation) return;
    try {
      if (confirmation === "safe-clear") {
        await send({ action: "safe-clear" }, "Safe Clear sent");
      } else if (confirmation === "reset") {
        const result = await mutate(`/api/rundown/live/sessions?rundownId=${encodeURIComponent(rundownId)}`, "POST", {}, "New live session started", fetchRundown);
        if (result) setRunReady(true);
      } else if (sessionId) {
        const response = await fetch(`/api/rundown/live/sessions/${encodeURIComponent(sessionId)}/${confirmation}?rundownId=${encodeURIComponent(rundownId)}`, { method: "POST" });
        if (!response.ok) return { error: await response.text() };
        setRunReady(false);
        await fetchRundown();
        return { status: confirmation === "complete" ? "Live session completed." : "Live session abandoned." };
      }
      return undefined;
    } finally {
      setConfirmation(null);
    }
  }, [confirmation, send, mutate, rundownId, fetchRundown, sessionId]);

  const runCue = rundown[runCueIndex];
  const nextRunCue = rundown.slice(runCueIndex + 1).find((cue) => cue.enabled && cue.status !== "complete");

  return {
    runReady, setRunReady,
    runCueIndex, setRunCueIndex,
    confirmation, setConfirmation,
    confirmationButton,
    runCue,
    nextRunCue,
    goCue,
    enterRun,
    confirmSessionAction,
  } as const;
}
