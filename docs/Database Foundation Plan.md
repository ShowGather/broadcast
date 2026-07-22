# ShowGather Database Foundation Plan

## Purpose

This milestone adds PostgreSQL-backed persistence for ShowGather product
configuration and published durable presentation state. It does not change the
media-time authority: HLS metadata and the Player's media-PTS scheduler remain
responsible for when transient graphics appear and expire.

## Responsibility boundary

```text
Database: organisations, channels, productions, rundowns, durable snapshots,
          command audit records, and dispatch status

Timed transport: compact `pc` events over live ID3, or rehearsal SSE

Player: media-PTS scheduling, transient expiry, rendering, stale-snapshot
        rejection, and revision-gap recovery
```

The canonical presentation model stays transport-independent. PostgreSQL never
becomes a substitute for timed metadata or a wall-clock timer for graphics.

## Published state and outbox policy

The system distinguishes three states for a live durable command:

1. **Accepted** — validated, idempotently recorded, assigned a channel
   revision, and waiting in the outbox.
2. **Dispatched** — the injector accepted the compact event with a successful
   HTTP response. The command's durable effect is applied to the published
   snapshot in the same database transaction that records dispatch.
3. **Failed** — injector delivery failed. The command remains inspectable and
   retryable, but it never changes the viewer snapshot.

```text
Operator command
  -> transaction: reserve revision + accepted command + pending outbox
  -> ordered dispatcher: send the next unresolved channel revision
  -> transaction: mark dispatched + update published snapshot
  -> timed metadata reaches the media timeline and Player
```

The snapshot revision therefore means **the highest durable revision successfully
published to live transport**, never merely the highest command accepted by the
API.

An injector response is successful only when it has a 2xx HTTP status. A
non-2xx response is a dispatch failure, even if it has a JSON body.

## Ordering and retries

- Durable commands dispatch strictly by channel revision.
- Revision `N + 1` is held while `N` is pending, failed, or otherwise
  unresolved.
- A retry preserves the original event ID and revision.
- If the injector accepts an event but database finalisation fails, finalisation
  is retried idempotently with the same record. No new revision or event ID is
  allocated.
- Re-dispatch is allowed only when acceptance is uncertain; Player event-ID and
  revision handling protects it from duplicate presentation effects.
- Deliberately cancelling a failed revision is a future operator recovery
  action; this first milestone does not silently skip revisions.

## Rehearsal isolation

Rehearsal remains on the existing development-only SSE transport. It does not
write live outbox records, does not advance live channel revisions, and does
not change live published snapshots. Rehearsal execution progress may be
persisted separately for operator continuity.

## Initial persistent model

- Organisation
- Channel
- Production
- Rundown and ordered rundown cues
- Published durable presentation snapshot
- Presentation command audit log
- Ordered presentation outbox records
- Separate live and rehearsal rundown execution records

Flexible command payloads and presentation state use JSONB. Stable identifiers,
status values, revisions, timestamps, and ordering use normal relational
columns.

## Baseline and seed behaviour

The seeded Demo Channel starts with an intentional durable baseline snapshot.
The Player's embedded baseline is retained only as an offline/API-unavailable
fallback. A successfully hydrated database snapshot always replaces it.

## Non-goals

This milestone does not add accounts, authentication, roles, billing, asset
libraries, templates, collaboration, automation, analytics, or a general event
sourcing platform.
