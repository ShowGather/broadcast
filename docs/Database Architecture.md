# Database Architecture

## Runtime flow

```text
Operator control or rundown GO
        |
        v
Canonical presentation command
        |
        v
API transaction: accepted command + reserved revision + outbox record
        |
        v
Ordered injector dispatcher
        |
        +-- failure --> failed/retryable command; published snapshot unchanged
        |
        +-- successful 2xx injector response --> finalisation transaction
                                                 |
                                                 v
                                  command dispatched + snapshot revision advances
                                                 |
                                                 v
                           compact ID3 / MPEG-TS / HLS -> Player media-PTS scheduler
```

## State ownership

| Concern | Owner |
| --- | --- |
| Channel, production, rundown, cue configuration | PostgreSQL via API |
| Accepted/dispatched/failed live command history | PostgreSQL via API |
| Late-join durable state | Published PostgreSQL snapshot |
| Timed delivery | ID3 reference adapter or rehearsal SSE |
| Transient start/expiry | Player media PTS |
| Rendering and responsive regions | Presentation model and Viewer |

The published snapshot contains only durable presentation state. It is not a
replay log and it never recreates temporary graphics for late joiners.

## Revisions

`Channel.nextRevision` records accepted durable revisions. `Channel.publishedRevision`
and `PresentationSnapshot.revision` record only the highest revision that was
successfully dispatched and applied to the snapshot.

This difference is intentional. A failed revision blocks later durable revisions
until it is retried or deliberately resolved, avoiding revision gaps in viewers.

## Persistence model

The initial schema includes Organisation, Channel, Production, Rundown,
RundownCue, PresentationSnapshot, PresentationCommand, PresentationOutbox,
RundownExecutionSession, and RundownCueExecution. JSONB is restricted to
canonical presentation payloads and serialised durable state.

## Rehearsal

Rehearsal stays separate from live transport and live presentation state. It
uses the existing SSE listener; persisted rehearsal execution progress is not a
live command, outbox record, snapshot update, or live channel revision.
