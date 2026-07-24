"use client";

import { useEffect, useState, useCallback } from "react";
import type { Channel, Production, Rundown } from "@/lib/types";

interface Params {
  channelId: string;
  productionId: string;
  setChannelId: React.Dispatch<React.SetStateAction<string>>;
  setProductionId: React.Dispatch<React.SetStateAction<string>>;
  setRundownId: React.Dispatch<React.SetStateAction<string>>;
  navigate: (path: string) => void;
}

export function useAdminSelectors({ channelId, productionId, setChannelId, setProductionId, setRundownId, navigate }: Params) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [rundowns, setRundowns] = useState<Rundown[]>([]);
  const [selectionError, setSelectionError] = useState("");

  useEffect(() => {
    fetch("/api/channels").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load channels");
      const items = await response.json() as Channel[];
      setChannels(items);
      setChannelId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load channels"));
  }, []);

  useEffect(() => {
    if (!channelId) return;
    fetch(`/api/channels/${channelId}/productions`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load productions");
      const items = await response.json() as Production[];
      setProductions(items);
      setProductionId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load productions"));
  }, [channelId]);

  useEffect(() => {
    if (!productionId) return;
    fetch(`/api/productions/${productionId}/rundowns`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load rundowns");
      const items = await response.json() as Rundown[];
      setRundowns(items);
      setRundownId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load rundowns"));
  }, [productionId]);

  const refreshProductions = useCallback(async () => {
    if (!channelId) return;
    const response = await fetch(`/api/channels/${channelId}/productions`);
    if (response.ok) setProductions(await response.json() as Production[]);
  }, [channelId]);

  const refreshRundowns = useCallback(async () => {
    if (!productionId) return;
    const response = await fetch(`/api/productions/${productionId}/rundowns`);
    if (response.ok) setRundowns(await response.json() as Rundown[]);
  }, [productionId]);

  const selectedProduction = productions.find((p) => p.id === productionId);

  return {
    channels,
    productions,
    rundowns,
    selectionError,
    selectedProduction,
    refreshProductions,
    refreshRundowns,
  } as const;
}
