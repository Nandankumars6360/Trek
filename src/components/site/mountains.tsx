// Original illustrations (no licensed photos needed). Admins can upload a real hero photo in Content.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="20" fill="#1f3d2b" />
      <circle cx="27" cy="13" r="4" fill="#c2622d" />
      <path d="M5 30 L15 16 L21 24 L25 19 L35 30 Z" fill="#f4f1ea" />
      <path d="M15 16 L18 20 L16 21 L13.5 18.5 Z" fill="#a9c29a" />
    </svg>
  );
}

export function MountainScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 640" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7e3d6" />
          <stop offset="0.55" stopColor="#f4f1ea" />
          <stop offset="1" stopColor="#e3ecdc" />
        </linearGradient>
      </defs>
      <rect width="1440" height="640" fill="url(#sky)" />
      <circle cx="1080" cy="210" r="70" fill="#c2622d" opacity="0.85" />
      <path d="M0 420 L180 260 L300 340 L470 180 L640 330 L780 240 L960 380 L1130 220 L1300 330 L1440 270 L1440 640 L0 640 Z" fill="#a9c29a" opacity="0.7" />
      <path d="M0 500 L220 340 L380 430 L560 300 L760 450 L920 350 L1110 470 L1290 360 L1440 430 L1440 640 L0 640 Z" fill="#4f7d55" />
      <path d="M0 560 L160 470 L330 540 L520 430 L700 560 L880 480 L1060 570 L1250 470 L1440 540 L1440 640 L0 640 Z" fill="#2f5d3a" />
      <path d="M0 610 L300 560 L620 620 L900 570 L1200 625 L1440 590 L1440 640 L0 640 Z" fill="#1f3d2b" />
      <path d="M560 300 L600 330 L585 338 L545 312 Z M470 180 L500 205 L485 210 L455 192 Z M1130 220 L1162 246 L1146 252 L1116 232 Z" fill="#f4f1ea" opacity="0.9" />
    </svg>
  );
}

export function TrekPlaceholder({ seed = 0, className }: { seed?: number; className?: string }) {
  const palettes = [['#e3ecdc', '#a9c29a', '#4f7d55', '#1f3d2b'], ['#f7e3d6', '#e9c4a8', '#c2622d', '#6b3a1c'], ['#e9e3d6', '#a9c29a', '#2f5d3a', '#13261b']];
  const p = palettes[seed % palettes.length];
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <rect width="400" height="260" fill={p[0]} />
      <circle cx={280 - (seed % 3) * 60} cy="70" r="26" fill="#c2622d" opacity="0.8" />
      <path d="M0 180 L90 100 L150 150 L230 70 L320 160 L400 110 L400 260 L0 260 Z" fill={p[1]} />
      <path d="M0 220 L110 150 L190 200 L280 130 L400 210 L400 260 L0 260 Z" fill={p[2]} />
      <path d="M0 245 L140 215 L260 248 L400 225 L400 260 L0 260 Z" fill={p[3]} />
    </svg>
  );
}
