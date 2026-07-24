"use client";

export function PlayerPreview({ url, title, profile = "desktop", className = "" }: { url: string; title: string; profile?: "desktop" | "mobile" | "tv"; className?: string }) {
  if (!url) return <p className="hint">Choose a channel to load the preview.</p>;
  return <iframe title={title} src={url} className={`player-preview player-preview--${profile} ${className}`} />;
}
