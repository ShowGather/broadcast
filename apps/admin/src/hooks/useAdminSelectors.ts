import { useEffect, useState, useCallback } from "react";
import type { AdminRoute } from "../routing.js";
import type { Channel, Production, Rundown } from "../types.js";

interface Params {
  route: AdminRoute;
  navigate: (route: AdminRoute, replace?: boolean) => void;
}

export function useAdminSelectors({ route, navigate }: Params) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [rundowns, setRundowns] = useState<Rundown[]>([]);
  const [channelId, setChannelId] = useState(() => localStorage.getItem("showgather.channelId") ?? "");
  const [productionId, setProductionId] = useState(() => route.productionId ?? localStorage.getItem("showgather.productionId") ?? "");
  const [rundownId, setRundownId] = useState(() => localStorage.getItem("showgather.rundownId") ?? "");
  const [selectionError, setSelectionError] = useState("");

  useEffect(() => { if (route.productionId && route.productionId !== productionId) setProductionId(route.productionId); }, [productionId, route.productionId]);

  useEffect(() => {
    fetch("/api/channels").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load channels");
      const items = await response.json() as Channel[]; setChannels(items);
      setChannelId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load channels"));
  }, []);
  useEffect(() => { if (channelId) localStorage.setItem("showgather.channelId", channelId); }, [channelId]);
  useEffect(() => { if (productionId) localStorage.setItem("showgather.productionId", productionId); }, [productionId]);
  useEffect(() => { if (rundownId) localStorage.setItem("showgather.rundownId", rundownId); }, [rundownId]);
  useEffect(() => {
    if (!channelId) return;
    fetch(`/api/channels/${channelId}/productions`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load productions");
      const items = await response.json() as Production[]; setProductions(items);
      if (route.productionId && !items.some((item) => item.id === route.productionId)) {
        setSelectionError("That production is unavailable. Choose an existing production or create a new one.");
        navigate({ workspace: "productions" }, true);
      }
      setProductionId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load productions"));
  }, [channelId, navigate, route.productionId]);
  useEffect(() => {
    if (!productionId) return;
    fetch(`/api/productions/${productionId}/rundowns`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load rundowns");
      const items = await response.json() as Rundown[]; setRundowns(items);
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

  const selectChannel = useCallback((nextChannelId: string) => {
    if (nextChannelId === channelId) return;

    // Clear dependent selections before fetching the new channel's catalogue.
    // This prevents a production or rundown from the previous channel being
    // presented as active while the replacement list is loading.
    setChannelId(nextChannelId);
    setProductionId("");
    setRundownId("");
    setProductions([]);
    setRundowns([]);
    setSelectionError("");
    localStorage.removeItem("showgather.productionId");
    localStorage.removeItem("showgather.rundownId");

    if (route.workspace !== "productions") {
      navigate({ workspace: "productions" });
    }
  }, [channelId, navigate, route.workspace]);

  const selectedProduction = productions.find((p) => p.id === productionId);

  return {
    channels, productions, rundowns,
    channelId, setChannelId: selectChannel,
    productionId, setProductionId,
    rundownId, setRundownId,
    selectionError, setSelectionError,
    selectedProduction,
    refreshProductions,
    refreshRundowns,
  } as const;
}
