export type AdminWorkspace = "productions" | "prepare" | "rehearse" | "run";

export interface AdminRoute {
  workspace: AdminWorkspace;
  productionId?: string;
}

export function parseAdminRoute(pathname: string): AdminRoute {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] !== "admin" || parts[1] !== "productions") return { workspace: "productions" };
  if (!parts[2]) return { workspace: "productions" };
  const workspace = parts[3];
  if (workspace === "prepare" || workspace === "rehearse" || workspace === "run") return { workspace, productionId: decodeURIComponent(parts[2]) };
  return { workspace: "productions" };
}

export function adminPath(route: AdminRoute): string {
  if (route.workspace === "productions" || !route.productionId) return "/admin/productions";
  return `/admin/productions/${encodeURIComponent(route.productionId)}/${route.workspace}`;
}
