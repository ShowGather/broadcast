# Pause, Seek, and Reload Behaviour

This document defines the explicit behaviour for the ShowGather Broadcast POC player when the user pauses, seeks, or reloads the page.

## Definitions

- **Queued event**: An event that has been received via ID3 metadata but whose target PTS has not yet been reached by the player.
- **Fired event**: An event that has been rendered as an overlay.
- **Seen ID**: The set of event IDs that have been received in the current player session (used for deduplication).

## Behaviour

### Normal Playback

Events are queued when `FRAG_PARSING_METADATA` fires. The `requestAnimationFrame` loop checks `video.currentTime` against each queued event's `metadataPts`. When `currentTime >= metadataPts`, the overlay is rendered and the event is removed from the queue.

### Pause

Pausing the video **naturally pauses event progression**. The `requestAnimationFrame` loop continues to run, but `video.currentTime` does not change, so no new events are fired. Events that were queued before the pause remain queued and will fire when playback resumes and the playhead reaches their PTS.

### Seek Forward

When the user seeks forward:
1. All queued events with `metadataPts <= video.currentTime` are **fired immediately** (they were missed during the seek).
2. All queued events with `metadataPts < video.currentTime` that are still relevant remain in the queue.
3. Events that have already been fired (their ID is in the seen set) are not re-fired.
4. Active overlays whose `hideAt` time has passed are removed.

### Seek Backward

When the user seeks backward:
1. Queued events are **not replayed** if their ID is already in the seen set.
2. Events whose PTS is now in the future remain in the queue.
3. The seen ID set is **not cleared** — this prevents duplicate overlays.
4. If the user seeks to a point before an event's PTS, and that event was already fired, it will **not** fire again.

### Reload (Page Refresh)

When the page is reloaded:
1. The seen ID set is **cleared** (new session).
2. Events may replay if the player re-downloads the same HLS fragments containing the ID3 metadata.
3. This is expected behaviour — a reload creates a new session.

### Duplicate Metadata Samples

hls.js does not deduplicate metadata samples. The same event may appear in multiple fragments. The player deduplicates using the seen ID set — if an event ID has already been received, it is skipped.

## Implementation Reference

```typescript
// seenIds: Set<string> — cleared on mount/unmount (new session)
// queue: QueuedEvent[] — events awaiting their PTS
// On FRAG_PARSING_METADATA:
//   1. Decode TPE1 text → JSON → validateEvent()
//   2. If event.id in seenIds → skip
//   3. Add to seenIds, push to queue with metadataPts = sample.pts
// On rAF tick:
//   1. For each queued event where video.currentTime >= metadataPts → fire overlay, log delta
//   2. Remove expired overlays (Date.now() >= hideAt)
// On seeking:
//   1. Filter queue to keep only future events
//   2. Filter active overlays to keep only non-expired ones
//   3. Do NOT clear seenIds
```
