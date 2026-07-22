import {
  applyPresentationCommand,
  createPersistentPresentationSnapshot,
  createV1PresentationBaseline,
  resolvePresentationCommand,
  resolvePresentationCue,
  type PresentationSnapshot,
  type PresentationState,
} from "@showgather/presentation-model";
import type { ShowGatherEvent } from "@showgather/event-schema";

/**
 * V1 local channel state. It intentionally stores only durable entries:
 * timed metadata still governs programme-time transients at the player.
 */
export class ChannelPresentationState {
  private state: PresentationState = createV1PresentationBaseline();
  private revision = 0;
  private readonly appliedEventIds = new Set<string>();

  /** Add the next durable revision before an event is encoded into timed ID3. */
  withRevision(event: ShowGatherEvent): ShowGatherEvent {
    if (!eventChangesPersistentState(event, this.revision + 1)) return event;
    return { ...event, r: this.revision + 1 };
  }

  apply(event: ShowGatherEvent): boolean {
    if (this.appliedEventIds.has(event.id)) return false;
    this.appliedEventIds.add(event.id);

    const persistent = eventChangesPersistentState(event, this.revision + 1);
    if (!persistent) return false;
    if (event.r !== undefined && event.r <= this.revision) return false;
    if (event.r !== undefined && event.r !== this.revision + 1) {
      throw new Error(`presentation revision ${event.r} is not next after ${this.revision}`);
    }

    this.state = applyPersistentEvent(this.state, event, this.revision + 1);
    this.revision += 1;
    return true;
  }

  snapshot(): PresentationSnapshot {
    return createPersistentPresentationSnapshot(this.state, this.revision);
  }

}

/** True when an event changes durable presentation state rather than only media-timed graphics. */
export function eventChangesPersistentState(event: ShowGatherEvent, revision: number): boolean {
  return event.t === "presentation.clear" || (
    event.t === "presentation.cue" &&
    resolvePresentationCue(event, revision).some((command) => command.action === "activate" && command.durationMs === undefined)
  ) || (
    event.t === "pc" &&
    resolvePresentationCommand(event, revision).some(
      (command) => command.action === "clear" || (command.action === "activate" && command.durationMs === undefined)
    )
  );
}

/** Applies only durable effects. Browser media PTS continues to govern transient commands. */
export function applyPersistentEvent(state: PresentationState, event: ShowGatherEvent, revision: number): PresentationState {
  if (event.t === "presentation.clear") {
    return applyPresentationCommand(state, { action: "clear", eventId: event.id, targetPts: 0 });
  }
  const commands = event.t === "pc"
    ? resolvePresentationCommand(event, revision)
    : event.t === "presentation.cue"
      ? resolvePresentationCue(event, revision)
      : [];
  return commands.reduce(
    (next, command) => command.action === "activate" && command.durationMs !== undefined ? next : applyPresentationCommand(next, command),
    state
  );
}
