import { createContext, useContext } from "react";
import type { AdminRoute } from "../routing.js";

export interface AdminStateValue {
  channelId: string;
  productionId: string;
  rundownId: string;
  workspace: string;
  navigate: (route: AdminRoute, replace?: boolean) => void;
  mutate: (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => Promise<{ id?: string } | undefined>;
  send: (payload: Record<string, unknown>, statusMessage: string) => void;
  status: string;
  setStatus: (v: string) => void;
  error: string;
  setError: (v: string) => void;
}

export const AdminStateContext = createContext<AdminStateValue | null>(null);

export function useAdminState(): AdminStateValue {
  const ctx = useContext(AdminStateContext);
  if (!ctx) throw new Error("useAdminState must be used within AdminStateContext");
  return ctx;
}
