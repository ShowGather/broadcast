# ShowGather Broadcast — Proof of Concept

A minimal end-to-end pipeline proving that timed ID3 metadata injected into an HLS live stream can trigger synchronized overlays in a web browser, rendered at the correct media playback time.

## Architecture

```
FFmpeg test source
  → id3injector
  → ShowGather packet-preserving TS segmenter
  → rolling HLS segments
  → nginx
  → hls.js
  → media-timeline sync client
  → overlay
```

## Quick Start

### Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Build shared packages
pnpm --filter @showgather/event-schema build
pnpm --filter @showgather/id3 build

# 3. Start the stream pipeline (FFmpeg → id3injector → HLS)
pnpm stream

# 4. In another terminal — serve HLS files
cd stream/hls && python3 -m http.server 8000

# 5. In another terminal — start the API
cd services/api && npx tsx src/server.ts

# 6. In another terminal — start the admin UI
cd apps/admin && npx vite --port 3002

# 7. In another terminal — start the player
cd apps/player && npx vite --port 3003
```

### Docker Compose

```bash
cd deploy/compose
docker compose up --build
```

## URLs

| Service | URL |
|---------|-----|
| Admin interface | http://localhost:3002 |
| Public player | http://localhost:3003 |
| HLS playlist | http://localhost:8000/hls/stream.m3u8 |
| API health | http://localhost:3001/api/health |
| Measurements | http://localhost:3001/api/measurements |
| id3injector API | http://localhost:8080/inject |

## Verification

### Check HLS segments for timed ID3

```bash
bash stream/scripts/verify-segments.sh
```

This inspects the latest `.ts` segment and confirms:
- A data stream exists (stream type 0x15)
- The codec is `timed_id3`
- The stream is present in the segment

### Manual ffprobe check

```bash
ffprobe -v quiet -show_streams -select_streams d:0 stream/hls/stream0.ts
```

### Inject a test event via API

```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Overlay","message":"Hello from ShowGather","durationMs":5000}'
```

### Inject directly via id3injector

```bash
curl -X POST http://localhost:8080/inject \
  -H "Content-Type: application/json" \
  -d '{"text":"Direct injection test"}'
```

## Event Format

Events are compact JSON encoded as ID3v2.4 TPE1 frames (max 127 bytes):

```json
{
  "v": 1,
  "id": "evt-abc12345",
  "t": "overlay.show",
  "p": {
    "title": "Goal!",
    "msg": "Home team scores",
    "dur": 5000
  }
}
```

| Field | Description |
|-------|-------------|
| `v` | Schema version (always 1) |
| `id` | Unique event ID for deduplication |
| `t` | Event type (`overlay.show`) |
| `p.title` | Display title |
| `p.msg` | Optional message body |
| `p.dur` | Duration in milliseconds before auto-hide |

## Sync Pipeline Details

1. **Admin triggers overlay** → POST /api/events
2. **API validates and encodes** → ShowGatherEvent → JSON → ID3v2.4 TPE1 frame → base64
3. **API injects** → POST to id3injector with `{"id3_base64":"..."}`
4. **id3injector inserts a timed-ID3 PES packet** → the payload remains intact for downstream transport
5. **ShowGather TS segmenter** → copies the original 188-byte MPEG-TS packets into rolling HLS segments without demuxing or remuxing, preserving the complete timed-ID3 payload byte-for-byte.
6. **hls.js receives** → `FRAG_PARSING_METADATA` event fires with `sample.data` (raw ID3 tag bytes)
7. **Client decodes** → `decodeTpe1Text(sample.data)` → JSON string → `validateEvent()`
8. **Client queues** → event stored with `metadataPts = sample.pts`
9. **rAF loop** → when `video.currentTime >= metadataPts`, overlay is rendered
10. **Auto-hide** → after `event.p.dur` ms, overlay is removed

## Pause/Seek/Reload Rules

See [docs/pause-seek-behaviour.md](docs/pause-seek-behaviour.md) for the complete specification.

**Summary:**
- **Pause**: Events naturally freeze (video.currentTime stops advancing)
- **Seek forward**: Missed events fire immediately; future events remain queued
- **Seek backward**: Already-fired events are not replayed (dedup by ID)
- **Reload**: New session — events may replay from re-downloaded fragments

## Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `docker compose up --build` starts the system | Verified locally |
| 2 | Public player plays the HLS stream | Verified (hls.js + HLS endpoint) |
| 3 | Admin page injects overlay events | Verified (POST /api/events) |
| 4 | Event is present as timed ID3 in .ts segment | **Verified** (ffprobe confirms 0x15) |
| 5 | hls.js receives via FRAG_PARSING_METADATA | Verified in the running POC |
| 6 | Client queues by PTS | Verified in the running POC (useSyncClient.ts) |
| 7 | Overlay renders at video.currentTime PTS | Verified in the running POC |
| 8 | Overlay hides after durationMs | Verified in the running POC |
| 9 | Duplicate events ignored | Verified in the running POC |
| 10 | Timing measured and reported to API | Verified in the running POC |
| 11 | Pause/seek follows documented rules | Documented + verified in the running POC |
| 12 | README explains run/verify steps | This file |

## What Was Verified Locally

- id3injector successfully inserts a complete timed-ID3 PES packet
- FFmpeg demux/remux was found to remove the outer ID3v2 header and is therefore not used for HLS packaging in this proof of concept.
- The ShowGather packet-preserving TS segmenter preserves the complete ID3 tag and metadata PID.
- hls.js receives the metadata through `FRAG_PARSING_METADATA`
- The client queues the event by PTS and renders the overlay against `video.currentTime`

## Known POC Limitations

### 127-byte TPE1 payload limit

Events are encoded as ID3v2.4 TPE1 text frames, which have a maximum payload of **127 bytes**. The current compact event format fits:

```json
{"v":1,"id":"evt-abc123","t":"overlay.show","p":{"title":"Goal!","msg":"Home team scores","dur":5000}}
```

This is approximately 104 bytes. Richer events (longer titles, multiple fields) will exceed this limit. Future approaches: CBOR encoding, event-ID-only transport with cached payloads, or CMAF `emsg` for fMP4.

### No burned-in timecode

FFmpeg's `drawtext` filter is unavailable in this build (no libfreetype). The test card shows no timecode overlay, making visual timing assessment harder. The sync log panel and measurements API serve this purpose instead.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Event schema | TypeScript + JSON Schema validation |
| ID3 encode/decode | Custom TPE1 frame builder/parser |
| Backend API | Fastify (Node.js) |
| Admin UI | React + Vite |
| Player | React + Vite + hls.js |
| Stream source | FFmpeg (testsrc2 + sine tone) |
| Metadata injector | id3injector (Go) |
| HLS packaging | ShowGather packet-preserving TS segmenter |
| HLS serving | Python http.server (local) / nginx (Docker) |
