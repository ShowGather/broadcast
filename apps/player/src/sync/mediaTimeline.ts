/**
 * Pure media-timeline scheduling helpers.
 *
 * This module deliberately has no React, hls.js, or transport dependency. The
 * caller supplies decoded events and the current media PTS; this module decides
 * which events should fire and which active items remain visible.
 */

export interface ScheduledEvent<T> {
  eventId: string;
  targetPts: number;
  durationMs: number;
  payload: T;
}

export type ActiveEvent<T extends ScheduledEvent<unknown>> = T & {
  expiresAtPts: number;
};

export interface TimelineAdvance<T extends ScheduledEvent<unknown>> {
  fired: T[];
  queue: T[];
  active: ActiveEvent<T>[];
}

/**
 * Advance a timeline while media is playing.
 *
 * Events fire once their target PTS has been reached. Visibility is measured
 * against media PTS, so pausing playback also pauses the lifetime of active
 * presentation items. A late transient event is acknowledged as fired but is
 * not made visible if its media-time duration has already elapsed.
 */
export function advanceMediaTimeline<T extends ScheduledEvent<unknown>>(
  queue: T[],
  active: ActiveEvent<T>[],
  currentPts: number
): TimelineAdvance<T> {
  const fired: T[] = [];
  const remaining: T[] = [];
  const newlyActive: ActiveEvent<T>[] = [];

  for (const event of queue) {
    if (currentPts < event.targetPts) {
      remaining.push(event);
      continue;
    }

    fired.push(event);
    const expiresAtPts = event.targetPts + event.durationMs / 1000;
    if (currentPts < expiresAtPts) {
      newlyActive.push({ ...event, expiresAtPts });
    }
  }

  return {
    fired,
    queue: remaining,
    active: [...active, ...newlyActive].filter((event) => currentPts < event.expiresAtPts),
  };
}

/**
 * Apply the POC's seek policy.
 *
 * Seeking forward discards queued transient events that are already in the
 * past. Seeking backward does not replay previously seen events; active items
 * stay active until their media-time expiry.
 */
export function seekMediaTimeline<T extends ScheduledEvent<unknown>>(
  queue: T[],
  active: ActiveEvent<T>[],
  currentPts: number
): Pick<TimelineAdvance<T>, "queue" | "active"> {
  return {
    queue: queue.filter((event) => currentPts < event.targetPts),
    active: active.filter((event) => currentPts < event.expiresAtPts),
  };
}
