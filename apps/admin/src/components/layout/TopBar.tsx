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
    <header className="admin-shell__top-bar">
      <div className="flex items-center px-4">
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
          <p className="text-xs text-slate-600">{subtitle}</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 px-2 overflow-x-auto" aria-label="Admin workspaces">
        <button
          className={`tab-button ${workspace === "productions" ? "aria-selected=\"true\"" : ""}`}
          data-page="productions"
          aria-selected={workspace === "productions"}
          onClick={() => onNavigate({ workspace: "productions" })}
        >
          Productions
        </button>
        <button
          className={`tab-button ${workspace === "prepare" ? "aria-selected=\"true\"" : ""}`}
          data-page="prepare"
          aria-selected={workspace === "prepare"}
          onClick={() => onNavigate({ workspace: "prepare" })}
        >
          Prepare
        </button>
        <button
          className={`tab-button ${workspace === "rehearse" ? "aria-selected=\"true\"" : ""}`}
          data-page="rehearse"
          aria-selected={workspace === "rehearse"}
          onClick={() => onNavigate({ workspace: "rehearse" })}
        >
          Rehearse
        </button>
        <button
          className={`tab-button ${workspace === "run" ? "aria-selected=\"true\"" : ""}`}
          data-page="run"
          aria-selected={workspace === "run"}
          onClick={() => onNavigate({ workspace: "run" })}
        >
          Run
        </button>
      </nav>

      <div className="flex items-center justify-between px-3 gap-2">
        {selectedProduction ? (
          <>
            <div className="text-xs font-bold text-slate-600">Current production</div>
            <div className="font-black">{selectedProduction.title}</div>
          </>
        ) : (
          <div className="text-xs font-bold text-slate-600">No production selected</div>
        )}
        <div className="flex gap-1 flex-wrap justify-end">
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
    </header>
  );
}
