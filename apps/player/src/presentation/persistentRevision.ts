import type { PresentationSnapshot } from "@showgather/presentation-model";

export interface EventRevisionDecision {
  applyPersistent: boolean;
  needsRecovery: boolean;
}

/**
 * Orders the durable snapshot path independently from media-time transients.
 * A cue can safely arrive while a snapshot request is in flight: an older
 * response is ignored instead of replacing newer presentation state.
 */
export class PersistentRevisionGate {
  private revision = 0;
  private recoveryRevision: number | null = null;

  currentRevision(): number {
    return this.revision;
  }

  applySnapshot(snapshot: PresentationSnapshot): boolean {
    const repairsGap = this.recoveryRevision !== null && snapshot.revision >= this.recoveryRevision;
    if (snapshot.revision <= this.revision && !repairsGap) return false;
    this.revision = Math.max(this.revision, snapshot.revision);
    if (repairsGap) this.recoveryRevision = null;
    return true;
  }

  applyEvent(revision: number | undefined): EventRevisionDecision {
    if (revision === undefined) return { applyPersistent: true, needsRecovery: false };
    if (revision <= this.revision) return { applyPersistent: false, needsRecovery: false };

    const needsRecovery = revision > this.revision + 1;
    this.revision = revision;
    if (needsRecovery) this.recoveryRevision = revision;
    return { applyPersistent: true, needsRecovery };
  }
}
