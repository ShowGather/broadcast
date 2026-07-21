// Package main implements a minimal packet-preserving MPEG-TS HLS segmenter.
//
// It reads 188-byte transport stream packets from stdin, detects segment
// boundaries using video PTS timestamps, and writes rolling HLS segments
// and a media playlist to an output directory.
//
// Every original TS packet is copied byte-for-byte. No elementary stream
// demuxing or remuxing occurs. PAT and PMT packets are cached and
// prepended to each segment.
//
// This is a proof-of-concept component, not a permanent ShowGather solution.
package main

import (
	"context"
	"encoding/binary"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	tsPacketSize   = 188
	syncByte       = 0x47
	clockFrequency = 90000
)

func main() {
	outDir := flag.String("o", "/hls", "output directory for HLS segments")
	targetDur := flag.Float64("d", 2.0, "target segment duration in seconds")
	maxSegs := flag.Int("max", 10, "maximum segments in playlist (0=unlimited)")
	flag.Parse()

	log.SetPrefix("[ts-seg] ")
	log.SetFlags(log.Ltime | log.Lmicroseconds)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		sig := <-sigCh
		log.Printf("received %v, shutting down", sig)
		cancel()
	}()

	if err := os.MkdirAll(*outDir, 0o755); err != nil {
		log.Fatalf("create output dir: %v", err)
	}

	seg := &segmenter{
		outDir:    *outDir,
		targetDur: *targetDur,
		maxSegs:   *maxSegs,
		videoPID:  -1,
		pmtPID:    -1,
		segStart:  time.Now(),
	}

	log.Printf("starting: out=%s target=%.1fs max=%d", *outDir, *targetDur, *maxSegs)

	if err := seg.run(ctx, os.Stdin); err != nil && ctx.Err() == nil {
		log.Fatalf("error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Segmenter
// ---------------------------------------------------------------------------

type segmenter struct {
	outDir    string
	targetDur float64
	maxSegs   int

	mu sync.Mutex

	// Cached transport packets
	patPacket []byte
	pmtPacket []byte
	pmtPID    int
	videoPID  int

	// PSI section reassembly: sections can span multiple TS packets
	psiBuf  []byte // accumulated section bytes
	psiPID  int    // PID of section being reassembled
	psiLen  int    // expected total section length (from section_length field)
	psiHave int    // bytes accumulated so far

	// Current segment state
	segIdx      int
	segBuf      []byte // raw packets accumulated for current segment
	segPkts     int
	segStart    time.Time
	segStartPTS int64
	segLastPTS  int64

	// Rolling playlist
	entries []segEntry

	// Tracks segment files removed during pruning so they can be deleted after
	// the playlist has been published.
	prunedNames []string
}

type segEntry struct {
	name     string
	duration float64
	seq      int
}

// run is the main loop.
func (s *segmenter) run(ctx context.Context, r io.Reader) error {
	buf := make([]byte, tsPacketSize)

	for {
		select {
		case <-ctx.Done():
			s.mu.Lock()
			if len(s.segBuf) > 0 {
				s.flushLocked()
			}
			s.mu.Unlock()
			return nil
		default:
		}

		if _, err := io.ReadFull(r, buf); err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				s.mu.Lock()
				if len(s.segBuf) > 0 {
					s.flushLocked()
				}
				s.mu.Unlock()
				return nil
			}
			return fmt.Errorf("read: %w", err)
		}

		if buf[0] != syncByte {
			return fmt.Errorf("lost MPEG-TS alignment")
		}

		pkt := make([]byte, tsPacketSize)
		copy(pkt, buf)
		s.processPacket(pkt)
	}
}

// processPacket handles one TS packet.
func (s *segmenter) processPacket(pkt []byte) {
	pid := parsePID(pkt)
	pusi := (pkt[1] & 0x40) != 0
	adaptCtrl := (pkt[3] & 0x30) >> 4

	// Reject packets with no payload (adaptation-only or reserved)
	if adaptCtrl == 0 || adaptCtrl == 2 {
		// No payload — still buffer the packet for segment continuity
		s.mu.Lock()
		s.segBuf = append(s.segBuf, pkt...)
		s.segPkts++
		s.mu.Unlock()
		return
	}

	payload, ok := getPayload(pkt)
	if !ok {
		s.mu.Lock()
		s.segBuf = append(s.segBuf, pkt...)
		s.segPkts++
		s.mu.Unlock()
		return
	}

	// Cache PAT/PMT packets for segment prepending
	if pid == 0 {
		s.patPacket = append(s.patPacket[:0], pkt...)
	}
	if s.pmtPID > 0 && pid == s.pmtPID {
		s.pmtPacket = append(s.pmtPacket[:0], pkt...)
	}

	// PSI section reassembly for PAT (PID 0) and PMT
	if pid == 0 || (s.pmtPID > 0 && pid == s.pmtPID) {
		s.reassemblePSI(pid, pusi, payload, pkt)
	}

	// Record video PTS information for segment timing when available.
	if s.videoPID > 0 && pid == s.videoPID {
		if pts, ok := parsePTSFromPayload(payload); ok {
			s.mu.Lock()
			if s.segStartPTS == 0 {
				s.segStartPTS = pts
			}
			s.segLastPTS = pts
			s.mu.Unlock()
		}
	}

	// Detect video PUSI for segment boundaries using the current video PTS when available.
	needFlush := false
	if s.videoPID > 0 && pid == s.videoPID && pusi {
		s.mu.Lock()
		if len(s.segBuf) > 0 {
			elapsedPTS := 0.0
			if s.segStartPTS > 0 && s.segLastPTS >= s.segStartPTS {
				elapsedPTS = float64(s.segLastPTS-s.segStartPTS) / float64(clockFrequency)
			}
			if elapsedPTS >= s.targetDur {
				needFlush = true
			}
		}
		s.mu.Unlock()

		if needFlush {
			s.mu.Lock()
			s.flushLocked()
			s.segStart = time.Now()
			s.segStartPTS = 0
			s.segLastPTS = 0
			s.mu.Unlock()
		}
	}

	// Append packet to current segment buffer
	s.mu.Lock()
	s.segBuf = append(s.segBuf, pkt...)
	s.segPkts++
	s.mu.Unlock()
}

// ---------------------------------------------------------------------------
// PSI section reassembly
// ---------------------------------------------------------------------------

// reassemblePSI accumulates PSI section bytes across multiple TS packets.
// When PUSI=1, any in-progress section is discarded and a new one starts.
func (s *segmenter) reassemblePSI(pid int, pusi bool, payload []byte, pkt []byte) {
	if pusi {
		// A PUSI packet may contain the end of a previous section
		// followed by pointer_field bytes, then the new section.
		// For simplicity, discard any partial section and start fresh.
		s.psiBuf = nil
		s.psiPID = 0
		s.psiLen = 0
		s.psiHave = 0

		if len(payload) < 1 {
			return
		}

		pointerField := int(payload[0])
		if 1+pointerField > len(payload) {
			return
		}

		sectionStart := payload[1+pointerField:]
		if len(sectionStart) < 3 {
			return
		}

		sectionLen := int(binary.BigEndian.Uint16(sectionStart[1:3]) & 0x03FF)
		expectedTotal := 3 + sectionLen // table_id(1) + section_length(2) + data(sectionLen)
		if expectedTotal < 8 || sectionLen < 5 {
			return
		}

		if len(sectionStart) >= expectedTotal {
			// Entire section fits in this packet
			s.handleSection(pid, sectionStart[:expectedTotal])
		} else {
			// Partial — start accumulating
			s.psiBuf = append([]byte{}, sectionStart...)
			s.psiPID = pid
			s.psiLen = expectedTotal
			s.psiHave = len(sectionStart)
		}
		return
	}

	// Continuation packet (PUSI=0)
	if s.psiBuf != nil && s.psiPID == pid {
		s.psiBuf = append(s.psiBuf, payload...)
		s.psiHave += len(payload)

		if s.psiLen > 0 && s.psiHave >= s.psiLen {
			s.handleSection(pid, s.psiBuf[:s.psiLen])
			s.psiBuf = nil
			s.psiPID = 0
			s.psiLen = 0
			s.psiHave = 0
		}
	}
}

// handleSection processes a complete PSI section.
func (s *segmenter) handleSection(pid int, section []byte) {
	tableID := section[0]

	if pid == 0 && tableID == 0x00 {
		s.parsePATSection(section)
	} else if pid == s.pmtPID && tableID == 0x02 {
		s.parsePMTSection(section)
	}
}

// ---------------------------------------------------------------------------
// PAT parsing
// ---------------------------------------------------------------------------

// parsePATSection parses a complete PAT section (table_id=0x00).
func (s *segmenter) parsePATSection(section []byte) {
	if len(section) < 8 {
		return
	}

	sectionLen := int(binary.BigEndian.Uint16(section[1:3]) & 0x03FF)
	expectedTotal := 3 + sectionLen

	// Clamp to available data
	if expectedTotal > len(section) {
		expectedTotal = len(section)
	}

	// Minimum PAT: table_id(1) + section_length(2) + transport_stream_id(2) +
	// reserved/version/current(1) + section_number(1) + last_section_number(1) +
	// at least one 4-byte program entry + CRC32(4) = 16
	if expectedTotal < 16 {
		return
	}

	// Program entries: bytes 8 to (expectedTotal - 4), stepping by 4
	dataEnd := expectedTotal - 4 // exclude CRC32
	for i := 8; i+4 <= dataEnd; i += 4 {
		progNum := binary.BigEndian.Uint16(section[i : i+2])
		pid := int(binary.BigEndian.Uint16(section[i+2:i+4]) & 0x1FFF)
		if progNum != 0 {
			log.Printf("PAT: program %d -> PMT PID %d (0x%x)", progNum, pid, pid)
			s.pmtPID = pid
			return
		}
	}
}

// ---------------------------------------------------------------------------
// PMT parsing
// ---------------------------------------------------------------------------

// parsePMTSection parses a complete PMT section (table_id=0x02).
func (s *segmenter) parsePMTSection(section []byte) {
	if s.videoPID > 0 {
		return // already found
	}

	if len(section) < 12 {
		return
	}

	sectionLen := int(binary.BigEndian.Uint16(section[1:3]) & 0x03FF)
	expectedTotal := 3 + sectionLen
	if expectedTotal > len(section) {
		expectedTotal = len(section)
	}

	// Fixed header: table_id(1) + section_length(2) + program_number(2) +
	// reserved/version/current(1) + section_number(1) + last_section_number(1) +
	// reserved/PCR_PID(2) + reserved/program_info_length(2) = 12
	if expectedTotal < 12 {
		return
	}

	programInfoLen := int(binary.BigEndian.Uint16(section[10:12]) & 0x0FFF)
	esInfoStart := 12 + programInfoLen
	dataEnd := expectedTotal - 4 // exclude CRC32

	if esInfoStart >= dataEnd {
		return
	}

	for i := esInfoStart; i+5 <= dataEnd; {
		streamType := section[i]
		pid := int(binary.BigEndian.Uint16(section[i+1:i+3]) & 0x1FFF)
		esInfoLen := int(binary.BigEndian.Uint16(section[i+3:i+5]) & 0x0FFF)

		next := i + 5 + esInfoLen
		if next > dataEnd {
			break
		}

		if streamType == 0x1B || streamType == 0x24 {
			log.Printf("PMT: video PID %d (0x%x) type=0x%02x", pid, pid, streamType)
			s.videoPID = pid
			return
		}

		i = next
	}

	// Fallback: first non-ID3 stream
	for i := esInfoStart; i+5 <= dataEnd; {
		streamType := section[i]
		pid := int(binary.BigEndian.Uint16(section[i+1:i+3]) & 0x1FFF)
		esInfoLen := int(binary.BigEndian.Uint16(section[i+3:i+5]) & 0x0FFF)

		next := i + 5 + esInfoLen
		if next > dataEnd {
			break
		}

		if streamType != 0x15 {
			log.Printf("PMT: fallback PID %d (0x%x) type=0x%02x", pid, pid, streamType)
			s.videoPID = pid
			return
		}

		i = next
	}
}

// ---------------------------------------------------------------------------
// Segment writing
// ---------------------------------------------------------------------------

// flushLocked writes the current segment and updates the playlist.
func (s *segmenter) flushLocked() {
	if len(s.segBuf) == 0 {
		return
	}

	seq := s.segIdx
	dur := s.segmentDuration()

	name := fmt.Sprintf("seg%06d.ts", seq)
	tmpPath := filepath.Join(s.outDir, name+".tmp")
	finalPath := filepath.Join(s.outDir, name)

	f, err := os.Create(tmpPath)
	if err != nil {
		log.Printf("ERROR create %s: %v", tmpPath, err)
		return
	}

	if s.patPacket != nil {
		if _, err := f.Write(s.patPacket); err != nil {
			log.Printf("ERROR write PAT packet %s: %v", tmpPath, err)
			f.Close()
			os.Remove(tmpPath)
			return
		}
	}
	if s.pmtPacket != nil {
		if _, err := f.Write(s.pmtPacket); err != nil {
			log.Printf("ERROR write PMT packet %s: %v", tmpPath, err)
			f.Close()
			os.Remove(tmpPath)
			return
		}
	}

	if _, err := f.Write(s.segBuf); err != nil {
		log.Printf("ERROR write segment payload %s: %v", tmpPath, err)
		f.Close()
		os.Remove(tmpPath)
		return
	}
	if err := f.Close(); err != nil {
		log.Printf("ERROR close segment %s: %v", tmpPath, err)
		os.Remove(tmpPath)
		return
	}

	if err := os.Rename(tmpPath, finalPath); err != nil {
		log.Printf("ERROR rename %s: %v", tmpPath, err)
		os.Remove(tmpPath)
		return
	}

	s.entries = append(s.entries, segEntry{
		name:     name,
		duration: dur,
		seq:      seq,
	})

	log.Printf("seg %d: %s dur=%.2fs pkts=%d bytes=%d",
		seq, name, dur, s.segPkts, len(s.segBuf)+2*tsPacketSize)

	s.segIdx++
	s.segBuf = s.segBuf[:0]
	s.segPkts = 0
	s.segStartPTS = 0
	s.segLastPTS = 0

	s.pruneOld()
	s.writePlaylist()
	for _, name := range s.prunedNames {
		if err := os.Remove(filepath.Join(s.outDir, name)); err != nil && !os.IsNotExist(err) {
			log.Printf("ERROR remove segment %s: %v", name, err)
		}
	}
	s.prunedNames = nil
}

func (s *segmenter) writePlaylist() {
	if len(s.entries) == 0 {
		return
	}

	var b strings.Builder
	b.WriteString("#EXTM3U\n")
	b.WriteString("#EXT-X-VERSION:3\n")

	maxDur := 0.0
	for _, e := range s.entries {
		if e.duration > maxDur {
			maxDur = e.duration
		}
	}
	b.WriteString(fmt.Sprintf("#EXT-X-TARGETDURATION:%d\n", int(maxDur+1)))
	b.WriteString(fmt.Sprintf("#EXT-X-MEDIA-SEQUENCE:%d\n", s.entries[0].seq))
	b.WriteString("#EXT-X-INDEPENDENT-SEGMENTS\n")
	b.WriteString("\n")

	for _, e := range s.entries {
		b.WriteString(fmt.Sprintf("#EXTINF:%.3f,\n", e.duration))
		b.WriteString(e.name + "\n")
	}

	path := filepath.Join(s.outDir, "stream.m3u8")
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, []byte(b.String()), 0o644); err != nil {
		log.Printf("ERROR write playlist: %v", err)
		return
	}
	if err := os.Rename(tmpPath, path); err != nil {
		log.Printf("ERROR rename playlist %s: %v", path, err)
		os.Remove(tmpPath)
	}
}

func (s *segmenter) pruneOld() {
	if s.maxSegs <= 0 || len(s.entries) <= s.maxSegs {
		return
	}

	s.prunedNames = nil
	for len(s.entries) > s.maxSegs {
		old := s.entries[0]
		s.entries = s.entries[1:]
		s.prunedNames = append(s.prunedNames, old.name)
		log.Printf("pruned %s", old.name)
	}
}

func (s *segmenter) segmentDuration() float64 {
	if s.segStartPTS > 0 && s.segLastPTS > s.segStartPTS {
		return float64(s.segLastPTS-s.segStartPTS) / float64(clockFrequency)
	}

	dur := time.Since(s.segStart).Seconds()
	if dur < 0.1 {
		dur = s.targetDur
	}
	return dur
}

// ---------------------------------------------------------------------------
// TS packet helpers
// ---------------------------------------------------------------------------

func parsePTSFromPayload(payload []byte) (int64, bool) {
	if len(payload) < 14 {
		return 0, false
	}
	if payload[0] != 0x00 || payload[1] != 0x00 || payload[2] != 0x01 {
		return 0, false
	}
	if len(payload) < 9 {
		return 0, false
	}

	// The synthetic POC packets are minimal PES packets and do not represent a
	// full MPEG-2 PES header, so we only check the stream ID and the presence of
	// a plausible PTS field before returning a best-effort value.
	if payload[3] == 0xE0 || payload[3] == 0xE1 || payload[3] == 0xE2 || payload[3] == 0xE3 {
		if len(payload) < 14 {
			return 0, false
		}
		if payload[6]&0xC0 != 0x80 {
			return 0, false
		}
		pts := ((int64(payload[9] & 0x0E)) << 29) |
			((int64(payload[10]) & 0xFF) << 22) |
			((int64(payload[11] & 0xFE)) << 14) |
			((int64(payload[12]) & 0xFF) << 7) |
			(int64(payload[13]&0xFE) >> 1)
		return pts, true
	}

	return 0, false
}

func parsePID(pkt []byte) int {
	return (int(pkt[1]&0x1f) << 8) | int(pkt[2])
}

// getPayload returns the payload bytes and whether the packet has valid payload.
func getPayload(pkt []byte) ([]byte, bool) {
	adaptCtrl := (pkt[3] & 0x30) >> 4
	var offset int
	switch adaptCtrl {
	case 1:
		offset = 4
	case 3:
		if len(pkt) < 5 {
			return nil, false
		}
		adaptLen := int(pkt[4])
		offset = 5 + adaptLen
	default:
		return nil, false
	}

	if offset >= tsPacketSize {
		return nil, false
	}

	return pkt[offset:], true
}
