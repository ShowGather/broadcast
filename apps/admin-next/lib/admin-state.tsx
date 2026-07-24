"use client";

import { createContext, useContext } from "react";
import type { Channel, Production, Rundown, RundownCue, OutboxItem } from "./types";
import type { useRundownEditor } from "@/hooks/use-rundown-editor";
import type { useCommandBuilder } from "@/hooks/use-command-builder";
import type { useShowConfiguration } from "@/hooks/use-show-configuration";
import type { useRunWorkspace } from "@/hooks/use-run-workspace";

export interface AdminStateValue {
  channelId: string;
  setChannelId: React.Dispatch<React.SetStateAction<string>>;
  productionId: string;
  setProductionId: React.Dispatch<React.SetStateAction<string>>;
  rundownId: string;
  setRundownId: React.Dispatch<React.SetStateAction<string>>;
  workspace: string;
  navigate: (path: string) => void;
  mutate: (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => Promise<{ id?: string } | undefined>;
  send: (payload: Record<string, unknown>, statusMessage: string) => void;
  status: string;
  setStatus: (v: string) => void;
  error: string;
  setError: (v: string) => void;
  channels: Channel[];
  productions: Production[];
  rundowns: Rundown[];
  selectedProduction: Production | undefined;
  refreshProductions: () => Promise<void>;
  refreshRundowns: () => Promise<void>;
  rundown: RundownCue[];
  sessionId: string;
  disabledCueCount: number;
  apiConnection: string;
  streamConnection: string;
  events: unknown[];
  outbox: OutboxItem[];
  unresolvedOutbox: OutboxItem[];
  fetchEvents: () => Promise<void>;
  fetchOutbox: () => Promise<void>;
  fetchRundown: () => Promise<void>;
  previewProfile: "desktop" | "mobile" | "tv";
  setPreviewProfile: (p: "desktop" | "mobile" | "tv") => void;
  layoutPreviewUrl: string;
  playerPreviewUrl: string;
  programmePreviewUrl: string;
  rundownEditor: ReturnType<typeof useRundownEditor>;
  commandBuilder: ReturnType<typeof useCommandBuilder>;
  showConfig: ReturnType<typeof useShowConfiguration>;
  runWorkspace: ReturnType<typeof useRunWorkspace>;
}

export const AdminStateContext = createContext<AdminStateValue | null>(null);

export function useAdminState(): AdminStateValue {
  const ctx = useContext(AdminStateContext);
  if (!ctx) throw new Error("useAdminState must be used within AdminStateContext");
  return ctx;
}
