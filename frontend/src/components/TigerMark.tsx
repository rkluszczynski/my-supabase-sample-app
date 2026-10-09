type TigerMarkProps = {
  className?: string
}

export function TigerMark({ className }: TigerMarkProps) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Tygrys aplikacji przykładowej" className={className}>
      <defs>
        <linearGradient id="tiger-fur" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffba65" />
          <stop offset="55%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#bb3c07" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#tiger-fur)" />
      <path d="M12 6 L22 18 L10 20 Z" fill="#1c1309" />
      <path d="M52 6 L42 18 L54 20 Z" fill="#1c1309" />
      <path d="M8 28 q10 4 18 2 l-2 5 q-9 2 -17 -2 Z" fill="#1c1309" />
      <path d="M56 28 q-10 4 -18 2 l2 5 q9 2 17 -2 Z" fill="#1c1309" />
      <path d="M26 12 q6 6 12 0 l2 6 q-8 6 -16 0 Z" fill="#1c1309" />
      <circle cx="24" cy="32" r="4" fill="#110b05" />
      <circle cx="40" cy="32" r="4" fill="#110b05" />
      <path d="M32 40 l-5 4 q5 6 10 0 Z" fill="#110b05" />
      <path d="M22 50 q10 8 20 0" stroke="#110b05" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}
