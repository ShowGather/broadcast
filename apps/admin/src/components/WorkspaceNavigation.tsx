import type { AdminRoute } from "../routing.js";

interface WorkspaceNavigationProps {
  route: AdminRoute;
  productionId: string;
  productionSwitchLocked: boolean;
  onNavigate: (route: AdminRoute, replace?: boolean) => void;
}

export function WorkspaceNavigation({
  route,
  productionId,
  productionSwitchLocked,
  onNavigate,
}: WorkspaceNavigationProps) {
  const isProductionsHome = route.workspace === "productions";
  const workspace = isProductionsHome ? "prepare" : route.workspace;

  return (
    <>
      <nav className="admin-shell__nav" aria-label="Production workspace">
        <button
          className={route.workspace === "productions" ? "active" : ""}
          onClick={() => onNavigate({ workspace: "productions" })}
        >
          Productions
        </button>
        {(["prepare", "rehearse", "run"] as const).map((item) => (
          <button
            key={item}
            disabled={!productionId}
            className={workspace === item ? "active" : ""}
            onClick={() =>
              onNavigate({ workspace: item, productionId })
            }
          >
            {item}
          </button>
        ))}
      </nav>

      {route.workspace === "rehearse" && (
        <section className="rehearsal-banner" role="status">
          <strong>REHEARSAL OUTPUT ONLY</strong>
          <span>
            Changes are visible only in opted-in rehearsal Players. Live
            presentation state will not change.
          </span>
        </section>
      )}
    </>
  );
}
