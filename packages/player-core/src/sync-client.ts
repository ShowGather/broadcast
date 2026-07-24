import Hls from "hls.js";
import { decodeTpe1Text } from "@showgather/id3";
import { validateEvent, type ShowGatherEvent } from "@showgather/event-schema";

export interface HlsClientOptions {
  hlsUrl: string;
  onTimedEvent?: (event: ShowGatherEvent, metadataPts: number) => void;
  onError?: (message: string) => void;
  onLoaded?: () => void;
}

export interface HlsClient {
  hls: Hls;
  destroy: () => void;
}

export function createHlsClient(video: HTMLVideoElement, options: HlsClientOptions): HlsClient | null {
  if (!Hls.isSupported()) return null;

  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: true,
    debug: true,
  });

  hls.loadSource(options.hlsUrl);
  hls.attachMedia(video);

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    options.onLoaded?.();
    video.play().catch(() => {
      options.onError?.("Click play to start");
    });
  });

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return;
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        options.onError?.("Network error — retrying...");
        hls.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        options.onError?.("Media error — recovering...");
        hls.recoverMediaError();
        break;
      default:
        options.onError?.("Fatal error — reload to retry");
        hls.destroy();
        break;
    }
  });

  hls.on(Hls.Events.FRAG_PARSING_METADATA, (_event, data) => {
    for (const sample of data.samples) {
      const text = decodeTpe1Text(sample.data);
      if (!text) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { continue; }
      const event = validateEvent(parsed);
      if (!event) continue;
      options.onTimedEvent?.(event, sample.pts);
    }
  });

  return {
    hls,
    destroy: () => {
      hls.destroy();
    },
  };
}
