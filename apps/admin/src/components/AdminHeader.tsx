import type { AdminRoute } from "../routing.js";

interface AdminHeaderProps {
  route: AdminRoute;
  workspace: string;
  apiConnection: "checking" | "connected" | "offline";
  streamConnection: "checking" | "connected" | "offline";
  diagnosticsOpen: boolean;
  onToggleDiagnostics: () => void;
  onNavigateHome: () => void;
}

export function AdminHeader({
  route,
  workspace,
  apiConnection,
  streamConnection,
  diagnosticsOpen,
  onToggleDiagnostics,
  onNavigateHome,
}: AdminHeaderProps) {
  const isProductionsHome = route.workspace === "productions";

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
    <header className="admin-shell__header">
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
      <div className="admin-shell__status">
        <p className={`connection connection--${apiConnection}`}>
          API {apiConnection}
        </p>
        <p className={`connection connection--${streamConnection}`}>
          Stream {streamConnection}
        </p>
        <button
          type="button"
          className="diagnostics-toggle"
          aria-expanded={diagnosticsOpen}
          onClick={onToggleDiagnostics}
        >
          {diagnosticsOpen ? "Hide diagnostics" : "Diagnostics"}
        </button>
      </div>
    </header>
  );
}
