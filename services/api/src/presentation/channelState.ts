import {
  applyPresentationCommand,
  createPersistentPresentationSnapshot,
  createV1PresentationBaseline,
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

  apply(event: ShowGatherEvent): boolean {
    if (this.appliedEventIds.has(event.id)) return false;
    this.appliedEventIds.add(event.id);

    if (event.t === "presentation.clear") {
      this.state = applyPresentationCommand(this.state, { action: "clear", eventId: event.id, targetPts: 0 });
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
}
