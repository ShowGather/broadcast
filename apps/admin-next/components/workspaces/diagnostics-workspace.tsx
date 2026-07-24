"use client";

import { useAdminState } from "@/lib/admin-state";
import { ThreeColumnWorkspace } from "@/components/ui/three-column-workspace";
import { WorkspacePanel } from "@/components/ui/workspace-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { PrimaryAction, SecondaryAction } from "@/components/ui/action-buttons";

interface EventItem {
  id: string;
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
}

export function DiagnosticsWorkspace() {
  const { apiConnection, streamConnection, events, outbox, unresolvedOutbox, fetchEvents, fetchOutbox, mutate } = useAdminState();
  const typedEvents = events as EventItem[];

  const left = (
    <WorkspacePanel heading="System health" hint="API and stream connection status.">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={`status-badge ${apiConnection ? "status-badge--ok" : "status-badge--error"}`}>
          <span className="status-badge__dot" />
          API: {apiConnection ? "Connected" : "Disconnected"}
        </div>
        <div className={`status-badge ${streamConnection ? "status-badge--ok" : "status-badge--error"}`}>
          <span className="status-badge__dot" />
          Stream: {streamConnection ? "Connected" : "Disconnected"}
        </div>
      </div>
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Event log">
      {typedEvents.length === 0 ? (
        <EmptyState heading="No events yet" description="Trigger an overlay from the Admin to see events here." />
      ) : (
        <ul className="event-log">
          {typedEvents.slice(-50).reverse().map((e) => (
            <li key={e.id} style={{ padding: 8, borderBottom: "1px solid #2a3a4e" }}>
              <span className="hint">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span style={{ marginLeft: 8, fontWeight: 500 }}>{e.type}</span>
              <span className="hint" style={{ marginLeft: 8 }}>{JSON.stringify(e.payload).slice(0, 80)}</span>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Dispatch outbox" variant="readiness">
      <p className="hint">{unresolvedOutbox.length} unresolved item{unresolvedOutbox.length === 1 ? "" : "s"}</p>
      <button onClick={fetchEvents} disabled={outbox.length === 0} style={{ marginTop: 8 }}>Refresh events</button>
      <button onClick={fetchOutbox} disabled={outbox.length === 0} style={{ marginTop: 8 }}>Refresh outbox</button>
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}