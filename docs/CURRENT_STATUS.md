# ShowGather current status

Last verified baseline: `ce29168 chore(admin): complete shell regression and consistency pass`

Known-good tag: `v0.3.0-admin-shell`

ShowGather is currently a local pilot for timed interactive broadcast presentation. The system is not production infrastructure, but the local vertical slice is reproducible and verified.

## Active applications

| Application | Role | Local port |
| --- | --- | --- |
| `apps/admin` | Vite operator application with permanent shell, production preparation, rundown editing, rehearsal, live operation and diagnostics. | `3002` in Compose |
| `apps/player` | Vite HLS viewer/player with hls.js metadata handling, media-PTS scheduling, presentation rendering, desktop/mobile/TV profiles and companion panels. | `3003` in Compose |
| `services/api` | Fastify API for productions, rundowns, presentation commands, snapshots, ordered outbox delivery, rehearsal SSE and ID3 injection. | `3001` in Compose |

`apps/web` is present as a Next.js audience/demo wrapper, but the current pilot baseline is centred on the Vite Admin, Vite Player and Fastify API.

## Shared packages

| Package | Current role |
| --- | --- |
| `@showgather/event-schema` | Validates compact timed transport events, including presentation cues and clears. |
| `@showgather/id3` | Encodes and decodes ID3/TPE1 payloads for the reference timed-metadata path. |
| `@showgather/presentation-model` | Transport-independent presentation state, reducer behaviour, regions, instances, placements, snapshots and restoration. |
| `@showgather/player-core` | Player-side timed cue resolution, media timeline scheduling and persistent revision gating. |
| `@showgather/player-ui` | Shared React viewer presentation components: provider, regions, shell and companion panels. |

## Working capabilities

Verified in the current pilot baseline:

- Production catalogue and production preparation in the Admin shell.
- Persisted rundown and cue editing.
- Fitted Admin previews for Prepare, Rundown, Viewer, Show Configuration, Rehearse, Run and Diagnostics.
- Viewer placement configuration for profile-aware presentation instances.
- Reusable Show Configuration packages and copying into productions.
- Isolated rehearsal execution through the SSE rehearsal path.
- Focused live execution through durable presentation commands.
- Durable delivery blocking when unresolved outbox records exist.
- Retry and same-revision cancellation semantics in the durable delivery model.
- Safe Clear, Complete, Abandon and Reset controls with deliberate confirmation.
- Diagnostics separated from normal operator workflow.
- Timed ID3 is preserved in HLS segments by the packet-preserving segmenter.
- Player media-PTS scheduling and media-time expiry remain the timing authority.
- PostgreSQL persistence for channels, productions, rundowns, command history, snapshots and outbox records.
- Late-join/reconnect durable presentation state has been verified in earlier V1.1/V1.2 milestone checks.
- Player now includes a custom fullscreen presentation control that targets the composed Player root so video, graphics, surrounds and controls remain in the fullscreen element where the browser supports element fullscreen.

## Known limitations

- Native video-control fullscreen can still use the browser's video-only fullscreen path and may hide DOM graphics. Operators/viewers should use the ShowGather fullscreen button for composed presentation fullscreen.
- Casting, AirPlay and Picture-in-Picture graphics behaviour is not yet verified. These browser/device paths may display only the video stream.
- Live delivery failure recovery has not been deliberately manufactured during the most recent manual Admin shell regression pass, although retry/cancel behaviour is covered by existing database milestone validation and Admin tests.
- The ordered outbox assumes one active API dispatcher process per database. Cross-process claiming is not implemented.
- PostgreSQL persistence is local-pilot infrastructure; there is no production backup, high availability or managed migration workflow.
- No accounts, authentication, permissions, roles or multi-operator collaboration.
- No asset/template library, arbitrary theme editor, plugin system, billing, analytics or production telemetry.
- Docker Compose is local pilot infrastructure, not a production deployment, CDN or observability stack.
- Broad browser/platform certification is not complete.

## Player fullscreen investigation

Current implementation after the fullscreen fix:

- The native media element is `<video className="video-player" controls autoPlay muted />`.
- Timed graphics are DOM elements rendered into `PresentationRegion name="video.overlay"` inside `.video-container`.
- Surround presentation regions (`header`, `left.rail`, `right.rail`, `footer`) are rendered by `ViewerShell` around `.video-container`.
- The custom ShowGather fullscreen button calls `requestFullscreen()` on `.player-root`, which contains the toolbar and complete `ViewerShell`.
- WebKit-prefixed `webkitRequestFullscreen` and `webkitfullscreenchange` are handled for browsers that support the prefixed element fullscreen path.
- The implementation deliberately does not call `video.webkitEnterFullscreen()`, because that path fullscreens only the video and hides DOM graphics.
- The Player can be embedded by Admin previews and audience web pages; iframe fullscreen availability still depends on the embedding page allowing fullscreen. The shared Admin `PlayerPreview` helper now sets `allowFullScreen`.

## Verification commands

Current baseline commands:

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm verify
pnpm --filter @showgather/admin test
docker compose --env-file .env -f deploy/compose/docker-compose.yml build
```

Latest baseline results:

| Command | Exit code | Result |
| --- | ---: | --- |
| `git status` | 0 | Clean working tree before release-baseline edits. |
| `git log --oneline -12` | 0 | Head was `ce29168`; preceding Admin shell commits were visible. |
| `git describe --tags --always` | 0 | `v0.3.0-admin-shell`. |
| `pnpm install` | 0 | Lockfile up to date; pnpm reported ignored dependency build-script warnings. |
| `pnpm typecheck` | 0 | All TypeScript workspace checks passed. |
| `pnpm build` | 0 | Event schema, ID3, presentation model, API, Admin, Player and Web builds passed. Player bundle size warning remains informational. |
| `pnpm verify` | 0 | HLS playlist and timed-ID3 data stream verified. |
| `pnpm --filter @showgather/admin test` | 0 | 48/48 Admin tests passed. |
| `docker compose --env-file .env -f deploy/compose/docker-compose.yml build` | 0 | Admin, API, HLS server, Player and Stream images built. Prisma emitted an OpenSSL detection warning during API image generation, but the build completed successfully. |
