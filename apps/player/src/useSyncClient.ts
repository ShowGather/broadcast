import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { decodeTpe1Text } from "@showgather/id3";
import { validateEvent, type ShowGatherEvent } from "@showgather/event-schema";

export interface SyncLogEntry {
  eventId: string;
  metadataPts: number;
  parsedAt: number;
  renderedAt: number | null;
  deltaMs: number | null;
  videoTimeAtRender: number | null;
  performanceNowParsed: number;
  performanceNowRendered: number | null;
}

interface QueuedEvent {
  event: ShowGatherEvent;
  metadataPts: number;
  receivedAt: number;
  perfAtParse: number;
}

interface ActiveOverlay extends QueuedEvent {
  hideAt: number;
}

const HLS_URL = "http://localhost:8000/hls/stream.m3u8";
const MAX_LOG_ENTRIES = 50;

function postMeasurement(entry: {
  eventId: string;
  metadataPts: number;
  parsedAtPlayerTime: number;
  renderedAtPlayerTime: number | null;
  performanceNowParsed: number;
  performanceNowRendered: number | null;
  deltaMs: number | null;
}) {
  fetch("/api/measurements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

export function useSyncClient(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [overlays, setOverlays] = useState<ActiveOverlay[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [status, setStatus] = useState<string>("Initializing...");

  const hlsRef = useRef<Hls | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<QueuedEvent[]>([]);
  const overlaysRef = useRef<ActiveOverlay[]>([]);

  const appendLog = useCallback((entry: SyncLogEntry) => {
    setSyncLog((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!Hls.isSupported()) {
      setStatus("HLS is not supported in this browser");
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      debug: true,
    });
    hlsRef.current = hls;

    hls.loadSource(HLS_URL);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus("Stream loaded — waiting for playback");
      video.play().catch(() => {
        setStatus("Click play to start");
      });
    });

    hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      console.log("[SG] FRAG_LOADED frag.size=" + data.frag.stats.total + " level=" + data.frag.level + " sn=" + data.frag.sn);
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            setStatus("Network error — retrying...");
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            setStatus("Media error — recovering...");
            hls.recoverMediaError();
            break;
          default:
            setStatus("Fatal error — reload to retry");
            hls.destroy();
            break;
        }
      }
    });

    hls.on(Hls.Events.FRAG_PARSING_METADATA, (_event, data) => {
      console.log("[SG] FRAG_PARSING_METADATA samples=" + data.samples.length);
      for (const sample of data.samples) {
        console.log("[SG] sample pts=" + sample.pts + " dts=" + sample.dts + " dataLen=" + (sample.data ? sample.data.length : 0));
        const text = decodeTpe1Text(sample.data);
        console.log("[SG] decodeTpe1Text result=" + (text !== null ? text.substring(0, 80) : "null"));
        if (!text) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          continue;
        }

        const event = validateEvent(parsed);
        if (!event) continue;

        if (seenIdsRef.current.has(event.id)) continue;
        seenIdsRef.current.add(event.id);

        const perfNow = performance.now();
        const entry: QueuedEvent = {
          event,
          metadataPts: sample.pts,
          receivedAt: Date.now(),
          perfAtParse: perfNow,
        };
        queueRef.current.push(entry);

        appendLog({
          eventId: event.id,
          metadataPts: sample.pts,
          parsedAt: Date.now(),
          renderedAt: null,
          deltaMs: null,
          videoTimeAtRender: null,
          performanceNowParsed: perfNow,
          performanceNowRendered: null,
        });
      }
    });

    let rafId: number;

    const tick = () => {
      const video = videoRef.current;
      if (!video || video.paused) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const currentVideoTime = video.currentTime;

      const remaining: QueuedEvent[] = [];
      for (const qe of queueRef.current) {
        if (currentVideoTime >= qe.metadataPts) {
          const hideAt = Date.now() + qe.event.p.dur;
          const overlay: ActiveOverlay = { ...qe, hideAt };
          overlaysRef.current = [...overlaysRef.current, overlay];
          setOverlays([...overlaysRef.current]);

          const perfRendered = performance.now();
          const renderedAt = Date.now();
          const deltaMs = (currentVideoTime - qe.metadataPts) * 1000;

          appendLog({
            eventId: qe.event.id,
            metadataPts: qe.metadataPts,
            parsedAt: qe.receivedAt,
            renderedAt,
            deltaMs,
            videoTimeAtRender: currentVideoTime,
            performanceNowParsed: qe.perfAtParse,
            performanceNowRendered: perfRendered,
          });

          postMeasurement({
            eventId: qe.event.id,
            metadataPts: qe.metadataPts,
            parsedAtPlayerTime: qe.receivedAt,
            renderedAtPlayerTime: renderedAt,
            performanceNowParsed: qe.perfAtParse,
            performanceNowRendered: perfRendered,
            deltaMs,
          });
        } else {
          remaining.push(qe);
        }
      }
      queueRef.current = remaining;

      const now = Date.now();
      const stillActive = overlaysRef.current.filter((o) => now < o.hideAt);
      if (stillActive.length !== overlaysRef.current.length) {
        overlaysRef.current = stillActive;
        setOverlays([...stillActive]);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      hls.destroy();
      hlsRef.current = null;
      queueRef.current = [];
      overlaysRef.current = [];
      seenIdsRef.current.clear();
    };
  }, [videoRef, appendLog]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onSeeking = () => {
      const currentTime = video.currentTime;
      queueRef.current = queueRef.current.filter(
        (qe) => currentTime < qe.metadataPts
      );
      const now = Date.now();
      overlaysRef.current = overlaysRef.current.filter((o) => now < o.hideAt);
      setOverlays([...overlaysRef.current]);
    };

    video.addEventListener("seeking", onSeeking);
    return () => video.removeEventListener("seeking", onSeeking);
  }, [videoRef]);

  return { overlays, syncLog, status };
}
