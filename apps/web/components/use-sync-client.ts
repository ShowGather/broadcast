"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { decodeTpe1Text } from "@showgather/id3";
import { validateEvent, type ShowGatherEvent } from "@showgather/event-schema";
import {
  advanceMediaTimeline,
  seekMediaTimeline,
  type ActiveEvent,
  type ScheduledEvent,
} from "@showgather/player-core";

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

interface QueuedEvent extends ScheduledEvent<ShowGatherEvent> {
  event: ShowGatherEvent;
  metadataPts: number;
  receivedAt: number;
  perfAtParse: number;
}

type ActiveOverlay = ActiveEvent<QueuedEvent>;

const MAX_LOG_ENTRIES = 50;

interface UseSyncClientOptions {
  hlsUrl: string;
  onTimedEvent?: (event: ShowGatherEvent, targetPts: number) => void;
  onMediaTime?: (currentPts: number) => void;
  rehearsal?: boolean;
}

export function useSyncClient(videoRef: React.RefObject<HTMLVideoElement | null>, options: UseSyncClientOptions) {
  const [overlays, setOverlays] = useState<ActiveOverlay[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [status, setStatus] = useState<string>("Initializing...");

  const hlsRef = useRef<Hls | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<QueuedEvent[]>([]);
  const overlaysRef = useRef<ActiveOverlay[]>([]);
  const onTimedEventRef = useRef(options.onTimedEvent);
  const onMediaTimeRef = useRef(options.onMediaTime);

  useEffect(() => {
    onTimedEventRef.current = options.onTimedEvent;
    onMediaTimeRef.current = options.onMediaTime;
  }, [options.onTimedEvent, options.onMediaTime]);

  const appendLog = useCallback((entry: SyncLogEntry) => {
    setSyncLog((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, []);

  const enqueueEvent = useCallback((event: ShowGatherEvent, metadataPts: number) => {
    if (seenIdsRef.current.has(event.id)) return;
    seenIdsRef.current.add(event.id);

    const perfNow = performance.now();
    queueRef.current.push({
      eventId: event.id,
      targetPts: metadataPts,
      durationMs: event.t === "overlay.show" ? event.p.dur : event.t === "presentation.cue" ? event.p.dur ?? 1 : 1,
      payload: event,
      event,
      metadataPts,
      receivedAt: Date.now(),
      perfAtParse: perfNow,
    });
    appendLog({
      eventId: event.id, metadataPts, parsedAt: Date.now(), renderedAt: null, deltaMs: null,
      videoTimeAtRender: null, performanceNowParsed: perfNow, performanceNowRendered: null,
    });
  }, [appendLog]);

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

    hls.loadSource(options.hlsUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus("Stream loaded — waiting for playback");
      video.play().catch(() => {
        setStatus("Click play to start");
      });
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
      for (const sample of data.samples) {
        const text = decodeTpe1Text(sample.data);
        if (!text) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          continue;
        }

        const event = validateEvent(parsed);
        if (!event) continue;

        enqueueEvent(event, sample.pts);
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
      onMediaTimeRef.current?.(currentVideoTime);

      const previousActive = overlaysRef.current;
      const next = advanceMediaTimeline(queueRef.current, previousActive, currentVideoTime);
      queueRef.current = next.queue;
      overlaysRef.current = next.active;

      for (const qe of next.fired) {
        onTimedEventRef.current?.(qe.event, qe.targetPts);
        const visible = qe.event.t !== "overlay.show" || currentVideoTime < qe.targetPts + qe.durationMs / 1000;
        if (visible) {
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
        }
      }

      if (
        previousActive.length !== next.active.length ||
        previousActive.some((overlay, index) => overlay !== next.active[index])
      ) {
        setOverlays([...next.active]);
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
  }, [videoRef, enqueueEvent, options.hlsUrl]);

  useEffect(() => {
    if (!options.rehearsal) return;
    const source = new EventSource("/api/rehearsal/stream");
    source.onmessage = (message) => {
      try {
        const event = validateEvent(JSON.parse(message.data));
        const video = videoRef.current;
        if (event && video) enqueueEvent(event, video.currentTime + 0.25);
      } catch { /* Ignore malformed rehearsal messages. */ }
    };
    return () => source.close();
  }, [videoRef, options.rehearsal, enqueueEvent]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onSeeking = () => {
      const currentTime = video.currentTime;
      const next = seekMediaTimeline(queueRef.current, overlaysRef.current, currentTime);
      queueRef.current = next.queue;
      overlaysRef.current = next.active;
      setOverlays([...next.active]);
    };

    video.addEventListener("seeking", onSeeking);
    return () => video.removeEventListener("seeking", onSeeking);
  }, [videoRef]);

  return { overlays, syncLog, status };
}
