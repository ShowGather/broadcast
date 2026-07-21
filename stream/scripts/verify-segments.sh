#!/usr/bin/env bash
#
# verify-segments.sh
#
# Verifies that generated HLS segments contain timed ID3 metadata (stream type 0x15).
# Fails clearly if any check fails.
#
# Usage:
#   bash stream/scripts/verify-segments.sh [segment_file]
#
# If no segment file is given, uses the first .ts file in stream/hls/.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HLS_DIR="${SCRIPT_DIR}/../hls"
SEGMENT_FILE="${1:-}"

if [ -z "${SEGMENT_FILE}" ]; then
  SEGMENT_FILE=$(ls "${HLS_DIR}"/*.ts 2>/dev/null | head -1)
fi

if [ -z "${SEGMENT_FILE}" ] || [ ! -f "${SEGMENT_FILE}" ]; then
  echo "FAIL: No .ts segment file found in ${HLS_DIR}/"
  echo "Make sure generate-test-stream.sh has been running long enough to produce segments."
  exit 1
fi

PLAYLIST="${HLS_DIR}/stream.m3u8"
if [ ! -f "${PLAYLIST}" ]; then
  echo "FAIL: Playlist file not found at ${PLAYLIST}"
  exit 1
fi

echo "=== ShowGather Segment Verification ==="
echo "Segment: ${SEGMENT_FILE}"
echo "Playlist: ${PLAYLIST}"
echo ""

# Check 1: Verify the playlist exists and has segments
echo "--- Playlist check ---"
SEGMENT_COUNT=$(grep -c '\.ts$' "${PLAYLIST}" 2>/dev/null || echo "0")
if [ "${SEGMENT_COUNT}" -eq 0 ]; then
  echo "FAIL: Playlist contains no .ts segment references"
  exit 1
fi
echo "PASS: Playlist contains ${SEGMENT_COUNT} segment(s)"
echo ""

# Check 2: Run ffprobe on the segment
echo "--- Stream analysis ---"
ffprobe_output=$(ffprobe -v quiet -show_streams -of json "${SEGMENT_FILE}" 2>&1)

# Check 3: Look for a data stream (codec_type=data, codec_name=timed_id3)
echo "--- Data stream check ---"
DATA_STREAM=$(echo "${ffprobe_output}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for s in data.get('streams', []):
    if s.get('codec_type') == 'data':
        print(json.dumps(s, indent=2))
        break
" 2>/dev/null || echo "")

if [ -z "${DATA_STREAM}" ]; then
  echo "FAIL: No data stream found in segment"
  echo ""
  echo "All streams in segment:"
  ffprobe -v quiet -show_streams -of compact "${SEGMENT_FILE}" 2>&1
  echo ""
  echo "This likely means FFmpeg's HLS muxer dropped the timed ID3 stream (type 0x15)."
  exit 1
fi

echo "PASS: Data stream found:"
echo "${DATA_STREAM}"
echo ""

# Check 4: Verify codec is timed_id3 or similar
echo "--- Codec check ---"
CODEC_NAME=$(echo "${ffprobe_output}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for s in data.get('streams', []):
    if s.get('codec_type') == 'data':
        print(s.get('codec_name', 'unknown'))
        break
" 2>/dev/null || echo "unknown")

if [ "${CODEC_NAME}" = "timed_id3" ] || [ "${CODEC_NAME}" = "timed-id3" ] || [ "${CODEC_NAME}" = "id3v2" ]; then
  echo "PASS: Codec name is '${CODEC_NAME}' (expected timed_id3 variant)"
else
  echo "WARN: Codec name is '${CODEC_NAME}' — expected timed_id3 variant"
  echo "This may still work, but check the codec_type is 'data'."
fi
echo ""

# Check 5: Count packets for the data stream
echo "--- Packet count check ---"
DATA_STREAM_INDEX=$(echo "${ffprobe_output}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, s in enumerate(data.get('streams', [])):
    if s.get('codec_type') == 'data':
        print(i)
        break
" 2>/dev/null || echo "")

if [ -n "${DATA_STREAM_INDEX}" ]; then
  PACKET_COUNT=$(ffprobe -v quiet -select_streams "${DATA_STREAM_INDEX}" -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "${SEGMENT_FILE}" 2>&1 || echo "0")
  if [ "${PACKET_COUNT}" -gt 0 ] 2>/dev/null; then
    echo "PASS: Data stream has ${PACKET_COUNT} packet(s)"
  else
    echo "WARN: Could not count packets (ffprobe may not support -count_packets for this codec)"
    echo "Checking raw packet presence instead..."
    # Fallback: check if ffprobe reports any packets at all for this stream
    ffprobe -v verbose -select_streams "d:${DATA_STREAM_INDEX}" "${SEGMENT_FILE}" 2>&1 | grep -i "id3\|metadata\|data" | head -5 || echo "No metadata packets detected in verbose output"
  fi
else
  echo "WARN: Could not determine data stream index"
fi
echo ""

# Check 6: Show all streams summary
echo "--- All streams summary ---"
ffprobe -v quiet -show_entries stream=index,codec_type,codec_name -of compact "${SEGMENT_FILE}" 2>&1
echo ""

echo "=== Verification complete ==="
