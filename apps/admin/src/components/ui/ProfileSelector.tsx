interface ProfileSelectorProps {
  /** Available profiles */
  profiles: readonly string[];
  /** Currently selected profile */
  selected: string;
  /** Callback when profile changes */
  onSelect: (profile: string) => void;
  /** Optional label for accessibility */
  label?: string;
}

/**
 * Consistent profile selector (desktop/mobile/TV).
 * Renders as a pill group with the active profile highlighted.
 */
export function ProfileSelector({ profiles, selected, onSelect, label = "Profile" }: ProfileSelectorProps) {
  return (
    <div className="profile-picker" role="group" aria-label={label}>
      {profiles.map((profile) => (
        <button
          key={profile}
          type="button"
          className={selected === profile ? "active" : ""}
          onClick={() => onSelect(profile)}
        >
          {profile}
        </button>
      ))}
    </div>
  );
}
