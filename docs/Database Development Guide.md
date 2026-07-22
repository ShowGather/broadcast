# Database Development Guide

ShowGather V1 uses PostgreSQL for product configuration, published durable
presentation state, audit history, and rundown execution continuity. It does
not use PostgreSQL as a media timer.

## First-time local setup

```bash
cp .env.example .env
# Edit both password occurrences in .env to the same local-only value.
pnpm install
pnpm pilot:up
```

The stack starts PostgreSQL with a named `postgres-data` volume, applies the
committed migration, and idempotently seeds the ShowGather Demo organisation,
Demo Channel, V1 Pilot production, and V1 Demonstration rundown.

## Database commands

Run these from `broadcast/`:

```bash
pnpm db:generate  # Generate Prisma Client
pnpm db:migrate   # Create/apply a development migration after schema changes
pnpm db:deploy    # Apply committed migrations without creating new ones
pnpm db:seed      # Idempotently seed the pilot data
pnpm db:reset     # Destructive: reset the local database, migrate, then seed
```

Normal pilot startup is non-destructive. `db:reset` is the deliberate local
recovery command.

## What persists

- organisations, channels, productions, rundowns, and ordered cue definitions;
- live and rehearsal rundown execution records;
- accepted/dispatched/failed live command history;
- outbox state and retry metadata;
- the latest successfully published durable presentation snapshot.

Transient lower thirds, alerts, and temporary sponsor takeovers are excluded
from the snapshot. The Player still schedules and expires them against media
PTS.

## Snapshot and outbox semantics

The API reserves a durable revision when it accepts a command. That command is
not visible to late joiners until the injector returns a 2xx response and the
outbox finalisation transaction has updated the snapshot.

```text
accepted/pending -> dispatched/published
                 -> failed/retryable
```

Failed commands do not change the published snapshot and block later durable
revisions for that channel. Retries retain the same event ID and revision.
This protects the Player's duplicate suppression and revision-gap recovery.

If injector acceptance succeeds but finalisation cannot be recorded, the same
event ID/revision is retained for idempotent recovery; no new revision is
allocated.

## Current limitations

- The first dispatcher is API-process-local; a later production increment
  should add robust cross-process claiming and an explicit operator retry or
  cancellation control.
- Admin currently loads the seeded default production/rundown rather than a
  production selector.
- Rehearsal execution records persist, but rehearsal commands remain SSE-only
  and never write live snapshots or live outbox rows.
