"use client";

import { type ReactNode } from "react";

interface AdminPreviewProps {
  url?: string;
  title: string;
  profile: "desktop" | "mobile" | "tv";
  variant?: "default" | "rehearse" | "run";
  showGuides?: boolean;
  children?: ReactNode;
}

export function AdminPreview({ url, title, profile, variant = "default", showGuides = false, children }: AdminPreviewProps) {
  return (
    <div className={`admin-preview admin-preview--${profile}${variant !== "default" ? ` admin-preview--${variant}` : ""}`}>
      <div className="admin-preview__stage">
        {url ? (
          <>
            <iframe title={title} src={url} className="admin-preview__frame" />
            {showGuides && (
              <div className="admin-preview__guides">
                <div className="admin-preview__safe-area" />
              </div>
            )}
          </>
        ) : (
          <div className="admin-preview__empty">
            <p>Select a channel to load the preview.</p>
          </div>
        )}
      </div>
      {children && <div className="admin-preview__controls">{children}</div>}
    </div>
  );
}
