"use client";

interface AdminStatusBarProps {
  apiConnection: "checking" | "connected" | "offline";
  streamConnection: "checking" | "connected" | "offline";
}

export function AdminStatusBar({ apiConnection, streamConnection }: AdminStatusBarProps) {
  return (
    <>
      <div className="status-bar__left">
        <span className={`status-indicator${apiConnection === "connected" ? " status-indicator--healthy" : ""}`}>
          API {apiConnection === "connected" ? "Connected" : apiConnection === "checking" ? "Checking…" : "Offline"}
        </span>
        <span className={`status-indicator${streamConnection === "connected" ? " status-indicator--healthy" : ""}`}>
          Stream {streamConnection === "connected" ? "Available" : streamConnection === "checking" ? "Checking…" : "Offline"}
        </span>
      </div>
      <div className="status-bar__right">
        No unresolved dispatch failures · All changes saved
      </div>
    </>
  );
}
