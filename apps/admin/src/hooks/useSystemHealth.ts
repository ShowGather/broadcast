import { useEffect, useState } from "react";

export function useSystemHealth() {
  const [apiConnection, setApiConnection] = useState<"checking" | "connected" | "offline">("checking");
  const [streamConnection, setStreamConnection] = useState<"checking" | "connected" | "offline">("checking");

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/status");
        const result = response.ok ? await response.json() as { stream?: "connected" | "offline" } : null;
        if (active) { setApiConnection(response.ok ? "connected" : "offline"); setStreamConnection(result?.stream === "connected" ? "connected" : "offline"); }
      } catch { if (active) { setApiConnection("offline"); setStreamConnection("offline"); } }
    };
    check(); const interval = window.setInterval(check, 5_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  return { apiConnection, streamConnection } as const;
}
