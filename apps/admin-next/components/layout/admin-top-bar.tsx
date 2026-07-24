"use client";

import { useRouter } from "next/navigation";

interface AdminTopBarProps {
  workspace: string;
  productionId?: string;
  productionTitle?: string;
}

const TABS = [
  { id: "productions", label: "Productions" },
  { id: "prepare", label: "Prepare" },
  { id: "rundown", label: "Rundown" },
  { id: "viewer", label: "Viewer" },
  { id: "configuration", label: "Show Configuration" },
  { id: "rehearse", label: "Rehearse" },
  { id: "run", label: "Run" },
] as const;

export function AdminTopBar({ workspace, productionId, productionTitle }: AdminTopBarProps) {
  const router = useRouter();

  const navigateTab = (tabId: string) => {
    if (tabId === "productions") {
      router.push("/admin/productions");
    } else if (productionId) {
      router.push(`/admin/productions/${encodeURIComponent(productionId)}/${tabId}`);
    }
  };

  return (
    <>
      <div className="top-bar__logo">
        <div className="top-bar__logo-title">SHOWGATHER</div>
        <div className="top-bar__logo-subtitle">Broadcast Admin</div>
      </div>

      <nav className="top-bar__nav" aria-label="Admin workspaces">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button${workspace === tab.id ? " tab-button--active" : ""}`}
            onClick={() => navigateTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="top-bar__info">
        {productionTitle && (
          <div className="top-bar__production">
            <div className="top-bar__production-label">Current production</div>
            <div className="top-bar__production-title">{productionTitle}</div>
          </div>
        )}
      </div>
    </>
  );
}
