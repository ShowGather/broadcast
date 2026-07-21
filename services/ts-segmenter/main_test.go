package main

import (
	"context"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// parsePID tests — regression for the uint8 shift overflow bug
// ---------------------------------------------------------------------------

func TestParsePID(t *testing.T) {
	tests := []struct {
		name string
		pid  int
	}{
		{"PAT", 0x0000},
		{"video", 0x0100},
		{"audio", 0x0101},
		{"PMT", 0x1000},
		{"metadata", 0x1002},
		{"maximum PID", 0x1FFF},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pkt := make([]byte, 188)
			pkt[0] = 0x47
			pkt[1] = byte((tt.pid>>8)&0x1f) | 0x40 // PUSI=1
			pkt[2] = byte(tt.pid & 0xff)
			pkt[3] = 0x10 // adaptCtrl=1

			got := parsePID(pkt)
			if got != tt.pid {
				t.Fatalf("parsePID() = 0x%04x, want 0x%04x", got, tt.pid)
			}
		})
	}
}

// TestParsePID_ShiftOverflow is the specific regression test for the bug
// where uint8 << 8 loses high bits.
func TestParsePID_ShiftOverflow(t *testing.T) {
	// Before the fix, these all returned 0x0000 because the high byte
	// was shifted in uint8 context, losing bits above 0xFF.
	regressionCases := []int{0x0100, 0x0101, 0x1000, 0x1FFF}
	for _, pid := range regressionCases {
		pkt := make([]byte, 188)
		pkt[0] = 0x47
		pkt[1] = byte((pid>>8)&0x1f) | 0x40
		pkt[2] = byte(pid & 0xff)
		pkt[3] = 0x10

		got := parsePID(pkt)
		if got != pid {
			t.Errorf("parsePID(0x%04x) = 0x%04x (old uint8 bug still present?)", pid, got)
		}
	}
}

// ---------------------------------------------------------------------------
// getPayload tests
// ---------------------------------------------------------------------------

func TestGetPayload(t *testing.T) {
	t.Run("payload only", func(t *testing.T) {
		pkt := make([]byte, 188)
		pkt[0] = 0x47
		pkt[3] = 0x10 // adaptCtrl=1
		payload, ok := getPayload(pkt)
		if !ok {
			t.Fatal("expected ok=true")
		}
		if len(payload) != 184 {
			t.Fatalf("payload length = %d, want 184", len(payload))
		}
	})

	t.Run("adaptation + payload", func(t *testing.T) {
		pkt := make([]byte, 188)
		pkt[0] = 0x47
		pkt[3] = 0x30 // adaptCtrl=3
		pkt[4] = 10   // adaptation_field_length
		payload, ok := getPayload(pkt)
		if !ok {
			t.Fatal("expected ok=true")
		}
		if len(payload) != 173 { // 188 - 5 - 10 = 173
			t.Fatalf("payload length = %d, want 173", len(payload))
		}
	})

	t.Run("adaptation only", func(t *testing.T) {
		pkt := make([]byte, 188)
		pkt[0] = 0x47
		pkt[3] = 0x20 // adaptCtrl=2
		_, ok := getPayload(pkt)
		if ok {
			t.Fatal("expected ok=false for adaptation-only")
		}
	})

	t.Run("reserved", func(t *testing.T) {
		pkt := make([]byte, 188)
		pkt[0] = 0x47
		pkt[3] = 0x00 // adaptCtrl=0
		_, ok := getPayload(pkt)
		if ok {
			t.Fatal("expected ok=false for reserved")
		}
	})
}

// ---------------------------------------------------------------------------
// parsePATSection tests
// ---------------------------------------------------------------------------

func makePATSection(programs []struct {
	progNum int
	pid     int
}) []byte {
	// PAT section: table_id(1) + section_length(2) + transport_stream_id(2) +
	// reserved/version/current(1) + section_number(1) + last_section_number(1) +
	// programs(4 each) + CRC32(4)
	sectionLen := 5 + len(programs)*4 + 4 // 5 fixed + programs + CRC
	total := 3 + sectionLen

	section := make([]byte, total)
	section[0] = 0x00 // table_id
	binary.BigEndian.PutUint16(section[1:3], uint16(sectionLen)&0x0FFF|0xB000)
	binary.BigEndian.PutUint16(section[3:5], 1) // transport_stream_id
	section[5] = 0xC1                           // version=0, current=1
	section[6] = 0x00                           // section_number
	section[7] = 0x00                           // last_section_number

	for i, p := range programs {
		off := 8 + i*4
		binary.BigEndian.PutUint16(section[off:off+2], uint16(p.progNum))
		binary.BigEndian.PutUint16(section[off+2:off+4], uint16(p.pid)&0x1FFF|0xE000)
	}
	return section
}

func TestParsePATSection_SingleProgram(t *testing.T) {
	seg := &segmenter{pmtPID: -1}
	section := makePATSection([]struct {
		progNum int
		pid     int
	}{{progNum: 1, pid: 4096}})

	seg.parsePATSection(section)

	if seg.pmtPID != 4096 {
		t.Fatalf("pmtPID = %d, want 4096", seg.pmtPID)
	}
}

func TestParsePATSection_TooShort(t *testing.T) {
	seg := &segmenter{pmtPID: -1}
	section := make([]byte, 8) // too short for valid PAT
	section[0] = 0x00
	seg.parsePATSection(section)
	if seg.pmtPID != -1 {
		t.Fatalf("pmtPID should remain -1 for short section, got %d", seg.pmtPID)
	}
}

func TestParsePATSection_ZeroProgramNumber(t *testing.T) {
	seg := &segmenter{pmtPID: -1}
	// program_number=0 entries should be skipped (network PID)
	section := makePATSection([]struct {
		progNum int
		pid     int
	}{{progNum: 0, pid: 0x1000}, {progNum: 1, pid: 4096}})

	seg.parsePATSection(section)
	if seg.pmtPID != 4096 {
		t.Fatalf("pmtPID = %d, want 4096 (should skip program 0)", seg.pmtPID)
	}
}

// ---------------------------------------------------------------------------
// parsePMTSection tests
// ---------------------------------------------------------------------------

func makePMTSection(pcrPID int, programInfoLen int, entries []struct {
	streamType byte
	pid        int
	esInfoLen  int
}) []byte {
	// section_length counts from byte 3 to end of section (including CRC):
	//   program_number(2) + reserved_ver_cur(1) + section_number(1) +
	//   last_section_number(1) + reserved_PCR_PID(2) + reserved_progInfoLen(2) +
	//   programInfoDescs(programInfoLen) + ES_entries + CRC(4)
	// = 13 + programInfoLen + esDataLen
	esDataLen := 0
	for _, e := range entries {
		esDataLen += 5 + e.esInfoLen
	}
	sectionLen := 13 + programInfoLen + esDataLen
	total := 3 + sectionLen

	section := make([]byte, total)
	section[0] = 0x02 // table_id = PMT
	binary.BigEndian.PutUint16(section[1:3], uint16(sectionLen)&0x0FFF|0xB000)
	binary.BigEndian.PutUint16(section[3:5], 1) // program_number
	section[5] = 0xC1                           // version, current
	section[6] = 0x00                           // section_number
	section[7] = 0x00                           // last_section_number
	binary.BigEndian.PutUint16(section[8:10], uint16(pcrPID)&0x1FFF|0xE000)
	binary.BigEndian.PutUint16(section[10:12], uint16(programInfoLen)&0x0FFF|0xF000)

	off := 12 + programInfoLen

	// ES entries
	for _, e := range entries {
		section[off] = e.streamType
		binary.BigEndian.PutUint16(section[off+1:off+3], uint16(e.pid)&0x1FFF|0xE000)
		binary.BigEndian.PutUint16(section[off+3:off+5], uint16(e.esInfoLen)&0x0FFF|0xF000)
		off += 5 + e.esInfoLen
	}
	return section
}

func TestParsePMTSection_H264Video(t *testing.T) {
	seg := &segmenter{videoPID: -1}
	section := makePMTSection(256, 0, []struct {
		streamType byte
		pid        int
		esInfoLen  int
	}{
		{0x1B, 256, 0},  // H.264
		{0x0F, 257, 0},  // AAC
		{0x15, 258, 15}, // timed ID3 with descriptors
	})

	seg.parsePMTSection(section)
	if seg.videoPID != 256 {
		t.Fatalf("videoPID = %d, want 256", seg.videoPID)
	}
}

func TestParsePMTSection_WithDescriptors(t *testing.T) {
	seg := &segmenter{videoPID: -1}
	// ES entries with non-zero ES_info_length
	section := makePMTSection(256, 0, []struct {
		streamType byte
		pid        int
		esInfoLen  int
	}{
		{0x0F, 257, 0},  // AAC — no descriptors
		{0x1B, 256, 12}, // H.264 — 12 bytes of descriptors
		{0x15, 258, 15}, // timed ID3 — 15 bytes of descriptors
	})

	seg.parsePMTSection(section)
	// Should find H.264 even though it's not the first entry and has descriptors
	if seg.videoPID != 256 {
		t.Fatalf("videoPID = %d, want 256 (should skip past AAC + skip descriptors)", seg.videoPID)
	}
}

func TestParsePMTSection_ZeroLengthDescriptors(t *testing.T) {
	seg := &segmenter{videoPID: -1}
	// All entries have esInfoLen=0
	section := makePMTSection(256, 0, []struct {
		streamType byte
		pid        int
		esInfoLen  int
	}{
		{0x1B, 256, 0},
		{0x0F, 257, 0},
	})

	seg.parsePMTSection(section)
	if seg.videoPID != 256 {
		t.Fatalf("videoPID = %d, want 256", seg.videoPID)
	}
}

func TestParsePMTSection_FallbackToFirstNonID3(t *testing.T) {
	seg := &segmenter{videoPID: -1}
	// No H.264 or H.265 — should fall back to first non-0x15 stream
	section := makePMTSection(257, 0, []struct {
		streamType byte
		pid        int
		esInfoLen  int
	}{
		{0x15, 258, 15}, // timed ID3 — skip
		{0x0F, 257, 0},  // AAC — use as fallback
	})

	seg.parsePMTSection(section)
	if seg.videoPID != 257 {
		t.Fatalf("videoPID = %d, want 257 (AAC fallback)", seg.videoPID)
	}
}

func TestParsePMTSection_AlreadyFound(t *testing.T) {
	seg := &segmenter{videoPID: 256}
	section := makePMTSection(256, 0, []struct {
		streamType byte
		pid        int
		esInfoLen  int
	}{
		{0x1B, 999, 0},
	})

	seg.parsePMTSection(section)
	if seg.videoPID != 256 {
		t.Fatalf("videoPID = %d, should remain 256 (already found)", seg.videoPID)
	}
}

type syncReader struct {
	data []byte
	idx  int
}

func (r *syncReader) Read(p []byte) (int, error) {
	if r.idx >= len(r.data) {
		return 0, os.ErrClosed
	}
	copyLen := len(p)
	if r.idx+copyLen > len(r.data) {
		copyLen = len(r.data) - r.idx
	}
	copy(p, r.data[r.idx:r.idx+copyLen])
	r.idx += copyLen
	return copyLen, nil
}

// ---------------------------------------------------------------------------
// Byte-preservation regression test
// ---------------------------------------------------------------------------

func TestFlushPrunesBeforePlaylistPublish(t *testing.T) {
	dir := t.TempDir()
	seg := &segmenter{
		outDir:    dir,
		targetDur: 1.0,
		maxSegs:   1,
		videoPID:  -1,
		pmtPID:    -1,
		segStart:  timeNow(),
		entries:   []segEntry{{name: "old.ts", duration: 1.0, seq: 0}},
	}

	seg.segBuf = []byte{0x47}
	seg.segPkts = 1
	seg.flushLocked()

	if _, err := os.Stat(filepath.Join(dir, "old.ts")); !os.IsNotExist(err) {
		t.Fatalf("expected old segment to be removed, got err=%v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "stream.m3u8")); err != nil {
		t.Fatalf("expected playlist to exist: %v", err)
	}
}

func TestRunFailsOnLostSync(t *testing.T) {
	tempR := &syncReader{data: []byte{0x00, 0x01}} // invalid sync byte
	seg := &segmenter{}
	if err := seg.run(context.Background(), tempR); err == nil {
		t.Fatal("expected sync loss error")
	}
}

func TestParsePTSFromPayload(t *testing.T) {
	payload := make([]byte, 14)
	payload[0] = 0x00
	payload[1] = 0x00
	payload[2] = 0x01
	payload[3] = 0xE0
	payload[6] = 0x80
	payload[8] = 0x05
	payload[9] = 0x00
	payload[10] = 0x00
	payload[11] = 0x00
	payload[12] = 0x00
	payload[13] = 0x00

	pts, ok := parsePTSFromPayload(payload)
	if !ok {
		t.Fatal("expected PTS parse to succeed")
	}
	if pts != 0 {
		t.Fatalf("expected zero PTS, got %d", pts)
	}
}

func TestBytePreservation_ID3MagicInSegment(t *testing.T) {
	// Build a minimal TS stream: PAT + PMT + one video packet with ID3 in PES
	dir := t.TempDir()
	seg := &segmenter{
		outDir:    dir,
		targetDur: 1.0,
		maxSegs:   5,
		videoPID:  -1,
		pmtPID:    -1,
		segStart:  timeNow(),
	}

	// 1. PAT packet — PID 0
	pat := make([]byte, 188)
	pat[0] = 0x47
	pat[1] = 0x40 // PUSI=1, PID high=0
	pat[2] = 0x00 // PID low=0
	pat[3] = 0x10 // adaptCtrl=1

	// PAT payload: pointer_field=0, table_id=0, section
	patPayload := pat[4:]
	patPayload[0] = 0x00 // pointer_field
	// table_id
	patPayload[1] = 0x00
	// section_length = 13 (minimal PAT with one program)
	binary.BigEndian.PutUint16(patPayload[2:4], 13|0xB000)
	// transport_stream_id
	binary.BigEndian.PutUint16(patPayload[4:6], 1)
	// version/current
	patPayload[6] = 0xC1
	patPayload[7] = 0x00 // section_number
	patPayload[8] = 0x00 // last_section_number
	// program 1 -> PMT PID 4096
	binary.BigEndian.PutUint16(patPayload[9:11], 1)
	binary.BigEndian.PutUint16(patPayload[11:13], 4096|0xE000)

	seg.processPacket(pat)

	// 2. PMT packet — PID 4096
	pmt := make([]byte, 188)
	pmt[0] = 0x47
	pmt[1] = 0x50 // PUSI=1, PID=0x10
	pmt[2] = 0x00 // PID=0x1000
	pmt[3] = 0x10

	pmtPayload := pmt[4:]
	pmtPayload[0] = 0x00 // pointer_field
	pmtPayload[1] = 0x02 // table_id = PMT
	// section_length = 20: fixed(5) + PCR(2) + progInfoLen(2) + 1 ES entry(5) + CRC(4) = 18
	// Actually: from byte 3 to end: prog_num(2) + ver(1) + sec_num(1) + last_sec(1) + PCR(2) + progInfoLen(2) + ES(5) + CRC(4) = 18
	binary.BigEndian.PutUint16(pmtPayload[2:4], 18|0xB000)
	binary.BigEndian.PutUint16(pmtPayload[4:6], 1)           // program_number
	pmtPayload[6] = 0xC1                                     // version/current
	pmtPayload[7] = 0x00                                     // section_number
	pmtPayload[8] = 0x00                                     // last_section_number
	binary.BigEndian.PutUint16(pmtPayload[9:11], 256|0xE000) // PCR PID
	binary.BigEndian.PutUint16(pmtPayload[11:13], 0xF000)    // program_info_length=0
	// ES entry: stream_type=0x1B (H.264), PID=256
	pmtPayload[13] = 0x1B
	binary.BigEndian.PutUint16(pmtPayload[14:16], 256|0xE000)
	binary.BigEndian.PutUint16(pmtPayload[16:18], 0xF000) // ES_info_length=0

	seg.processPacket(pmt)

	// 3. Video packet with ID3 magic in payload
	vpkt := make([]byte, 188)
	vpkt[0] = 0x47
	vpkt[1] = 0x41 // PUSI=1, PID=0x100 high
	vpkt[2] = 0x00 // PID=0x100
	vpkt[3] = 0x10

	// PES header + ID3 data
	vpayload := vpkt[4:]
	vpayload[0] = 0x00
	vpayload[1] = 0x00
	vpayload[2] = 0x01 // PES start code
	vpayload[3] = 0xE0 // stream_id = video
	// Place ID3v2.4 magic at known offset
	vpayload[10] = 0x49 // 'I'
	vpayload[11] = 0x44 // 'D'
	vpayload[12] = 0x33 // '3'
	vpayload[13] = 0x04 // version 4

	seg.processPacket(vpkt)

	// Force flush
	seg.mu.Lock()
	seg.flushLocked()
	seg.mu.Unlock()

	// Read the segment file
	files, _ := filepath.Glob(filepath.Join(dir, "seg*.ts"))
	if len(files) == 0 {
		t.Fatal("no segment files written")
	}

	data, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatalf("read segment: %v", err)
	}

	// Verify PAT is present (first packet should be PAT)
	if data[0] != 0x47 {
		t.Fatal("segment doesn't start with sync byte")
	}
	if parsePID(data) != 0 {
		t.Fatalf("first packet PID = 0x%04x, want 0x0000 (PAT)", parsePID(data))
	}

	// Verify the ID3 magic bytes survive in the segment
	found := false
	for i := 0; i+3 < len(data); i++ {
		if data[i] == 0x49 && data[i+1] == 0x44 && data[i+2] == 0x33 && data[i+3] == 0x04 {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("ID3v2.4 magic (49 44 33 04) not found in segment — byte preservation failed")
	}
}

func timeNow() time.Time { return time.Now() }
