import type { AdminRoute } from "../../routing.js";

interface TopBarProps {
  apiConnection: "checking" | "connected" | "offline";
  streamConnection: "checking" | "connected" | "offline";
  workspace: string;
  productionId: string | undefined;
  selectedProduction: { title: string } | undefined;
  diagnosticsOpen: boolean;
  onToggleDiagnostics: () => void;
  onNavigateHome: () => void;
  onNavigate: (route: AdminRoute, replace?: boolean) => void;
}

export function TopBar({
  apiConnection,
  streamConnection,
  workspace,
  productionId,
  selectedProduction,
  diagnosticsOpen,
  onToggleDiagnostics,
  onNavigateHome,
  onNavigate,
}: TopBarProps) {
  const isProductionsHome = workspace === "productions";

  let subtitle: string;
  if (isProductionsHome) {
    subtitle = "Choose or create a saved production";
  } else if (workspace === "run") {
    subtitle = "Focused live operation";
  } else if (workspace === "rehearse") {
    subtitle = "Safe rehearsal — no live presentation changes";
  } else {
    subtitle = "Prepare saved productions and rundowns";
  }

  return (
    <div className="admin-top-bar">
      <div className="admin-top-bar__identity">
        <div>
          <a
            className="admin-shell__brand"
            href="/admin/productions"
            onClick={(event) => {
              event.preventDefault();
              onNavigateHome();
            }}
          >
            ShowGather
          </a>
          <p>{subtitle}</p>
        </div>
      </div>

      <nav className="admin-top-bar__navigation" aria-label="Admin workspaces">
        <button
          className={`tab-button ${workspace === "productions" ? "active" : ""}`}
          data-page="productions"
          aria-selected={workspace === "productions"}
          onClick={() => onNavigate({ workspace: "productions" })}
        >
          Productions
        </button>
        <button
          className={`tab-button ${workspace === "prepare" ? "active" : ""}`}
          data-page="prepare"
          aria-selected={workspace === "prepare"}
          disabled={!productionId}
          onClick={() => onNavigate({ workspace: "prepare", productionId })}
        >
          Prepare
        </button>
        <button
          className={`tab-button ${workspace === "rehearse" ? "active" : ""}`}
          data-page="rehearse"
          aria-selected={workspace === "rehearse"}
          disabled={!productionId}
          onClick={() => onNavigate({ workspace: "rehearse", productionId })}
        >
          Rehearse
        </button>
        <button
          className={`tab-button ${workspace === "run" ? "active" : ""}`}
          data-page="run"
          aria-selected={workspace === "run"}
          disabled={!productionId}
          onClick={() => onNavigate({ workspace: "run", productionId })}
        >
          Run
        </button>
      </nav>

      <div className="admin-top-bar__context">
        {selectedProduction ? (
          <>
            <span>Current production</span>
            <strong>{selectedProduction.title}</strong>
          </>
        ) : (
          <span>No production selected</span>
        )}
        <div className="admin-top-bar__connections">
          <span className={`status status-${apiConnection === "connected" ? "healthy" : apiConnection === "checking" ? "warning" : "failed"}`}>
            API {apiConnection}
          </span>
          <span className={`status status-${streamConnection === "connected" ? "healthy" : streamConnection === "checking" ? "warning" : "failed"}`}>
            Stream {streamConnection}
          </span>
          <button
            type="button"
            className="diagnostics-toggle"
            aria-expanded={diagnosticsOpen}
            onClick={onToggleDiagnostics}
          >
            {diagnosticsOpen ? "Hide diagnostics" : "Diagnostics"}
          </button>
        </div>
      </div>
    </div>
  );
}
