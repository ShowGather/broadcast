import { createV1PresentationBaseline, type PresentationState } from "@showgather/presentation-model";

/** Static V1 content used to validate region routing before timed cues are connected. */
export function createDemoPresentationState(): PresentationState {
  return createV1PresentationBaseline();
}
