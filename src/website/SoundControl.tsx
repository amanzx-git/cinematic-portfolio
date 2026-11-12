export function SoundControl({ muted, consented, onToggle, allowConsent = false }: {
  allowConsent?: boolean; muted: boolean; consented: boolean; onToggle: () => void
}) {
  const silent = !consented || muted
  return <button className="sound-control" disabled={!consented && !allowConsent}
    aria-label={silent ? 'Unmute audio' : 'Mute audio'} aria-pressed={!silent} onClick={onToggle}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {silent ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />}
    </svg>
    <span>SOUND {silent ? 'OFF' : 'ON'}</span>
  </button>
}
