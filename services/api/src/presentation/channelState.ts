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
    if (!this.changesPersistentState(event)) return event;
    return { ...event, r: this.revision + 1 };
  }

  apply(event: ShowGatherEvent): boolean {
    if (this.appliedEventIds.has(event.id)) return false;
    this.appliedEventIds.add(event.id);

    const persistent = this.changesPersistentState(event);
    if (!persistent) return false;
    if (event.r !== undefined && event.r <= this.revision) return false;
    if (event.r !== undefined && event.r !== this.revision + 1) {
      throw new Error(`presentation revision ${event.r} is not next after ${this.revision}`);
    }

    if (event.t === "presentation.clear") {
      this.state = applyPresentationCommand(this.state, { action: "clear", eventId: event.id, targetPts: 0 });
      this.revision += 1;
      return true;
    }
    if (event.t === "pc") {
      for (const command of resolvePresentationCommand(event, this.revision + 1)) {
        if (command.action === "activate" && command.durationMs !== undefined) continue;
        this.state = applyPresentationCommand(this.state, command);
      }
      this.revision += 1;
      return true;
    }
    if (event.t !== "presentation.cue") return false;
    // Snapshot entries need a deterministic ordering even though their source
    // PTS is only known at the browser. Revision is a local durable ordering.
    for (const command of resolvePresentationCue(event, this.revision + 1)) {
      if (command.action === "activate" && command.durationMs !== undefined) continue;
      this.state = applyPresentationCommand(this.state, command);
    }
    this.revision += 1;
    return true;
  }

  snapshot(): PresentationSnapshot {
    return createPersistentPresentationSnapshot(this.state, this.revision);
  }

  private changesPersistentState(event: ShowGatherEvent): boolean {
    return event.t === "presentation.clear" || (
      event.t === "presentation.cue" &&
      resolvePresentationCue(event, this.revision + 1).some(
        (command) => command.action === "activate" && command.durationMs === undefined
      )
    ) || (
      event.t === "pc" &&
      resolvePresentationCommand(event, this.revision + 1).some(
        (command) => command.action === "clear" || (command.action === "activate" && command.durationMs === undefined)
      )
    );
  }
}
