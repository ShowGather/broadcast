interface PlayerPreviewProps {
  /** Preview URL */
  url: string;
  /** Preview title for accessibility */
  title: string;
  /** Profile for sizing */
  profile?: "desktop" | "mobile" | "tv";
  /** Optional className */
  className?: string;
}

/**
 * Consistent player preview iframe.
 * Used in Prepare (viewer), Rehearse, and Run workspaces.
 */
export function PlayerPreview({ url, title, profile = "desktop", className = "" }: PlayerPreviewProps) {
  if (!url) {
    return <p className="empty">Choose a channel to load the preview.</p>;
  }

  return (
    <iframe
      title={title}
      src={url}
      className={`player-preview player-preview--${profile} ${className}`}
    />
  );
}
