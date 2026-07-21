/**
 * ID3v2.4 TPE1 frame encode/decode for ShowGather POC.
 *
 * Encodes text into an ID3v2.4 tag with a single TPE1 frame,
 * compatible with id3injector's `{"id3_base64":"..."}` HTTP API.
 *
 * Decodes ID3v2.4 tags (from hls.js sample.data) to extract TPE1 text.
 */

const MAX_TEXT_LENGTH = 127;

/**
 * Encode a syncsafe 4-byte size (used in ID3v2 headers and frame headers).
 * Each byte uses only 7 bits (max value 2^28 - 1 = 268435455).
 */
function encodeSyncsafe(size: number): [number, number, number, number] {
  return [
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f,
  ];
}

/**
 * Decode a syncsafe 4-byte size.
 */
function decodeSyncsafe(bytes: Uint8Array, offset: number): number {
  return (
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ((bytes[offset]! & 0x7f) << 21) |
    ((bytes[offset + 1]! & 0x7f) << 14) |
    ((bytes[offset + 2]! & 0x7f) << 7) |
    (bytes[offset + 3]! & 0x7f)
  );
}

/**
 * Encode text as an ID3v2.4 tag with a single TPE1 frame.
 *
 * Format (matching id3injector's generateID3Frame):
 * - ID3v2.4 header (10 bytes): "ID3" + version (4, 0) + flags (0) + tag body size (syncsafe)
 * - Frame header (10 bytes): "TPE1" + frame payload size (syncsafe) + flags (0, 0)
 * - Frame payload: encoding byte (3 = UTF-8) + text bytes + null terminator
 *
 * Returns the complete ID3v2.4 tag as a Uint8Array.
 */
export function encodeTpe1Frame(text: string): Uint8Array {
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text too long: ${text.length} chars (max ${MAX_TEXT_LENGTH})`);
  }

  const textBytes = new TextEncoder().encode(text);
  const framePayloadSize = 1 + textBytes.length + 1; // encoding byte + text + null
  const tagBodySize = 10 + framePayloadSize; // frame header + frame payload
  const totalSize = 10 + tagBodySize; // ID3 header + tag body

  const buf = new Uint8Array(totalSize);
  let offset = 0;

  // ID3v2.4 header (10 bytes)
  buf[offset++] = 0x49; // 'I'
  buf[offset++] = 0x44; // 'D'
  buf[offset++] = 0x33; // '3'
  buf[offset++] = 4;    // version major
  buf[offset++] = 0;    // version revision
  buf[offset++] = 0;    // flags
  const tagSize = encodeSyncsafe(tagBodySize);
  buf[offset++] = tagSize[0];
  buf[offset++] = tagSize[1];
  buf[offset++] = tagSize[2];
  buf[offset++] = tagSize[3];

  // Frame header (10 bytes)
  buf[offset++] = 0x54; // 'T'
  buf[offset++] = 0x50; // 'P'
  buf[offset++] = 0x45; // 'E'
  buf[offset++] = 0x31; // '1'
  const frameSize = encodeSyncsafe(framePayloadSize);
  buf[offset++] = frameSize[0];
  buf[offset++] = frameSize[1];
  buf[offset++] = frameSize[2];
  buf[offset++] = frameSize[3];
  buf[offset++] = 0; // flags high byte
  buf[offset++] = 0; // flags low byte

  // Frame payload
  buf[offset++] = 3; // encoding: UTF-8
  buf.set(textBytes, offset);
  offset += textBytes.length;
  buf[offset] = 0; // null terminator

  return buf;
}

/**
 * Extract TPE1 text from an ID3v2.4 tag.
 *
 * Used to decode metadata received from hls.js FRAG_PARSING_METADATA samples.
 * sample.data is a Uint8Array containing the complete ID3 tag.
 *
 * Returns the TPE1 text string, or null if no TPE1 frame is found.
 */
export function decodeTpe1Text(data: Uint8Array): string | null {
  // Verify ID3v2.4 header
  if (data.length < 10) return null;
  if (data[0] !== 0x49 || data[1] !== 0x44 || data[2] !== 0x33) return null;
  if (data[3] !== 4) return null; // must be version 2.4

  const tagBodySize = decodeSyncsafe(data, 6);
  let offset = 10; // skip ID3v2.4 header
  const end = Math.min(10 + tagBodySize, data.length);

  while (offset + 10 <= end) {
    // Frame header
    const frameId = String.fromCharCode(data[offset]!, data[offset + 1]!, data[offset + 2]!, data[offset + 3]!);
    const frameSize = decodeSyncsafe(data, offset + 4);
    // offset + 8 = flags high, offset + 9 = flags low

    if (frameId === "TPE1") {
      // Found TPE1 frame
      const frameDataStart = offset + 10;
      if (frameDataStart >= end) return null;

      const encoding = data[frameDataStart]; // 0=ISO-8859-1, 1=UTF-16, 2=UTF-16BE, 3=UTF-8
      const textStart = frameDataStart + 1;
      const textEnd = Math.min(textStart + frameSize - 1, end);

      // Find null terminator
      let nullPos = textEnd;
      for (let i = textStart; i < textEnd; i++) {
        if (data[i] === 0) {
          nullPos = i;
          break;
        }
      }

      const textBytes = data.slice(textStart, nullPos);

      if (encoding === 3) {
        // UTF-8
        return new TextDecoder("utf-8").decode(textBytes);
      } else if (encoding === 0) {
        // ISO-8859-1
        return new TextDecoder("iso-8859-1").decode(textBytes);
      } else {
        // UTF-16 variants — use generic decoder
        return new TextDecoder().decode(textBytes);
      }
    }

    // Skip to next frame
    offset += 10 + frameSize;
  }

  return null;
}
