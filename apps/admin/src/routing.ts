export type AdminWorkspace = "productions" | "prepare" | "rehearse" | "run";
export type PrepareTab = "overview" | "rundown" | "viewer" | "configuration";

export interface AdminRoute {
  workspace: AdminWorkspace;
  productionId?: string;
  prepareTab?: PrepareTab;
}

export function parseAdminRoute(pathname: string, search = ""): AdminRoute {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] !== "admin" || parts[1] !== "productions") return { workspace: "productions" };
  if (!parts[2]) return { workspace: "productions" };
  const workspace = parts[3];
  if (workspace === "prepare") {
    const tab = new URLSearchParams(search).get("tab");
    return { workspace, productionId: decodeURIComponent(parts[2]), ...(tab === "rundown" || tab === "viewer" || tab === "configuration" ? { prepareTab: tab } : { prepareTab: "overview" }) };
  }
  if (workspace === "rehearse" || workspace === "run") return { workspace, productionId: decodeURIComponent(parts[2]) };
  return { workspace: "productions" };
}

export function adminPath(route: AdminRoute): string {
  if (route.workspace === "productions" || !route.productionId) return "/admin/productions";
  const base = `/admin/productions/${encodeURIComponent(route.productionId)}/${route.workspace}`;
  return route.workspace === "prepare" && route.prepareTab && route.prepareTab !== "overview" ? `${base}?tab=${route.prepareTab}` : base;
}
