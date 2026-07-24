"use client";

export function ProfileSelector({ profiles, selected, onSelect, label = "Profile" }: { profiles: readonly string[]; selected: string; onSelect: (profile: string) => void; label?: string }) {
  return (
    <div className="profile-picker" role="group" aria-label={label}>
      {profiles.map((profile) => (
        <button key={profile} type="button" className={selected === profile ? "active" : ""} onClick={() => onSelect(profile)}>
          {profile}
        </button>
      ))}
    </div>
  );
}
