# ShowGather V1 — Interactive Broadcast Pilot

ShowGather synchronises cue-driven graphics and surrounding web experiences with live HLS playback using timed metadata and media presentation timestamps (PTS).

This is a **V1.1 pilot release candidate built on a verified timed-metadata proof of concept**. It is demonstrable locally, not a production deployment.

## What V1 does

- Desktop surround regions, mobile companion panels, and a TV profile around a live HLS player.
- Direct configurable presentation commands and a focused operator rundown.
- Score, lower third, alert, sponsor takeover, ticker, and regional clear commands.
- Live ID3 transport plus a development-only rehearsal SSE path.
- Revisioned durable snapshots for late joins/reconnects; transient graphics remain tied to media PTS.
- Persistent channels, productions, rundowns, command history, and ordered
  recovery through retry or same-revision cancellation.

## Architecture

```text
Operator rundown or direct control
  → canonical presentation command
  → compact `pc` timed transport envelope
  → live ID3 / MPEG-TS / HLS, or rehearsal SSE
  → media-PTS scheduler
  → shared presentation state
  → video overlay and surrounding viewer regions
```

| Area | Responsibility |
| --- | --- |
| `apps/admin` | Operator controls and rundown |
| `apps/player` | HLS playback, PTS scheduling, viewer rendering |
| `packages/event-schema` | Compact transport validation |
| `packages/id3` | TPE1 encode/decode |
| `packages/presentation-model` | Transport-independent presentation state |
| `services/api` | Commands, revisions, snapshots, injection |
| `services/ts-segmenter` | Packet-preserving HLS segments |

## Pilot quick start

Prerequisites: Docker Desktop or OrbStack, Node 20+, and pnpm 10+.

```bash
cp .env.example .env
pnpm install
pnpm pilot:up
```

Allow roughly a minute for stream health and services. Open:

- Admin: `http://localhost:3002`
- Desktop: `http://localhost:3003`
- Mobile companion: `http://localhost:3003/?profile=mobile`
- TV: `http://localhost:3003/?profile=tv`
- API health: `http://localhost:3001/api/health`

See [Pilot Demonstration Runbook](docs/Pilot%20Demonstration%20Runbook.md) for the repeatable rundown, rehearsal flow, recovery checks, logs, reset procedure, and screenshots.

The local PostgreSQL workflow, committed migrations, seed data, and outbox
semantics are documented in [Database Development Guide](docs/Database%20Development%20Guide.md).

For the technical system overview, see [V1 Architecture](docs/V1%20Architecture.md).

```bash
pnpm pilot:down
```

## Event and presentation model

```text
Canonical presentation command
  ↓
compact `pc` transport envelope
  ↓
ID3 TPE1 reference adapter
```

The command model is not defined by ID3: timed ID3 is one V1 delivery adapter. The compact `pc` envelope is byte-bounded for the current 127-byte TPE1 limit.

## Timing, recovery, and seek policy

- **Pause:** presentation progression pauses with media time.
- **Seek forward:** passed transient cues are discarded; future cues remain queued.
- **Seek backward:** previously seen cue IDs are not replayed in the same session.
- **Late join/reconnect:** durable state arrives through a revisioned snapshot; future/transient changes arrive through timed metadata.
- **Transient graphics:** are not replayed from snapshots.

The canonical policy is [Pause, Seek, and Reload Behaviour](docs/pause-seek-behaviour.md).

## Technical foundation: timed ID3 reference transport

```text
Admin action → API → ID3 injection → MPEG-TS
→ packet-preserving segmenter → HLS → hls.js metadata → PTS scheduler
```

The custom TS segmenter preserves timed-ID3 packets where normal FFmpeg remuxing did not. The 127-byte TPE1 constraint is a deliberate V1 reference-adapter limitation; future adapters may use compact binary payloads, references, or CMAF `emsg`.

## Verification and development

```bash
pnpm build
pnpm typecheck
pnpm verify
```

CI reproduces builds, TypeScript tests, and TS-segmenter Go tests. Browser/HLS timing remains a documented Safari pilot acceptance test.

## Known V1 limitations

- PostgreSQL persistence is local-pilot infrastructure; no production backup,
  high-availability, or multi-operator deployment has been implemented.
- The ordered database outbox assumes one active API dispatcher process per
  database; multi-instance claiming is a later production increment.
- No accounts, authentication, roles, or multi-operator collaboration.
- No asset/template library or general plugin system.
- Compose is local demonstration infrastructure, not production packaging, CDN delivery, or observability.
- No production analytics/telemetry or broad browser/platform support guarantee.

## Contributing and security

A licence, contributor guide, and security policy require an explicit product/governance decision before external contributions are invited.
