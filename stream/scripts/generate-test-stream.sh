#!/usr/bin/env bash
#
# generate-test-stream.sh
#
# Generates a test card, pipes through id3injector (which injects timed ID3
# metadata), then packages as HLS via the packet-preserving ts-segmenter.
#
# Usage:
#   bash stream/scripts/generate-test-stream.sh
#
set -euo pipefail

HLS_DIR="${HLS_DIR:-/hls}"
ID3_INJECTOR="${ID3_INJECTOR:-/usr/local/bin/id3injector}"
TS_SEGMENTER="${TS_SEGMENTER:-/usr/local/bin/ts-segmenter}"
ID3_LISTEN="${ID3_LISTEN:-:8080}"
HLS_TIME="${HLS_TIME:-2}"
SEG_MAX="${SEG_MAX:-10}"

# Ensure output directory exists
mkdir -p "${HLS_DIR}"

# Clean previous segments
rm -f "${HLS_DIR}"/*.ts "${HLS_DIR}"/*.m3u8 "${HLS_DIR}"/*.tmp

echo "=== ShowGather Test Stream ==="
echo "HLS output: ${HLS_DIR}/stream.m3u8"
echo "id3injector HTTP API: http://localhost${ID3_LISTEN}/inject"
echo "Press Ctrl-C to stop."
echo ""

# Pipeline:
# 1. FFmpeg generates test card + sine tone → MPEG-TS on stdout
#    Fixed GOP (-g/-keyint_min/-sc_threshold) so every IDR lands at segment boundary
# 2. id3injector modifies PMT to add stream_type 0x15, injects timed ID3 via HTTP API
# 3. ts-segmenter copies 188-byte TS packets unchanged, writes HLS segments
#
exec ffmpeg -re \
  -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=86400" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=86400" \
  -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 128k \
  -f mpegts pipe:1 \
| "${ID3_INJECTOR}" -listen "${ID3_LISTEN}" -o - \
| "${TS_SEGMENTER}" -o "${HLS_DIR}" -d "${HLS_TIME}" -max "${SEG_MAX}"
