import { resolvePresentationCue, type PresentationCommand } from "@showgather/presentation-model";
import type { ShowGatherEvent } from "@showgather/event-schema";

export { resolvePresentationCue } from "@showgather/presentation-model";

export function resolveTimedPresentationEvent(event: ShowGatherEvent, targetPts: number): PresentationCommand[] {
  if (event.t === "presentation.clear") {
    return [{ action: "clear", eventId: event.id, targetPts }];
  }
  return event.t === "presentation.cue" ? resolvePresentationCue(event, targetPts) : [];
}
