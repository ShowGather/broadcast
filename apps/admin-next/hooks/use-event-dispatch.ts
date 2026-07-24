"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutboxItem, StoredEvent } from "@/lib/types";

interface Params {
  rehearsal: boolean;
  channelId: string;
}

export function useEventDispatch({ rehearsal, channelId }: Params) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/events");
      if (response.ok) setEvents(await response.json());
    } catch { /* Keep the latest known operator history. */ }
  }, []);

  const fetchOutbox = useCallback(async () => {
    if (!channelId) return;
    const response = await fetch(`/api/channels/${channelId}/presentation/outbox`);
    if (response.ok) setOutbox(await response.json());
  }, [channelId]);

  useEffect(() => {
    fetchEvents();
    const interval = window.setInterval(fetchEvents, 5_000);
    return () => window.clearInterval(interval);
  }, [fetchEvents]);

  useEffect(() => {
    fetchOutbox().catch(() => {});
    const interval = window.setInterval(() => { fetchOutbox().catch(() => {}); }, 5_000);
    return () => window.clearInterval(interval);
  }, [fetchOutbox]);

  const send = useCallback(async (body: Record<string, unknown>, success: string) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(rehearsal ? "/api/rehearsal/events" : "/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setStatus(`${rehearsal ? "Rehearsal: " : "Live: "}${success} — ${result.event?.id ?? "queued"} (${result.status ?? "pending"})`);
      if (!rehearsal) { fetchEvents(); fetchOutbox(); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send event");
    }
  }, [rehearsal, fetchEvents, fetchOutbox]);

  const mutate = useCallback(async (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json() as { id?: string };
      setStatus(success);
      await reload?.();
      return result;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save"); return undefined; }
  }, []);

  const unresolvedOutbox = outbox.filter((item) => item.status === "failed" || item.status === "pending");

  return {
    status, setStatus,
    error, setError,
    events,
    outbox,
    unresolvedOutbox,
    fetchEvents,
    fetchOutbox,
    send,
    mutate,
  } as const;
}
