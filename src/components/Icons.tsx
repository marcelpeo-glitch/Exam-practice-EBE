const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const FlagIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M4 22V4" />
    <path d="M4 4h12l-2 4 2 4H4" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);
export const CalcIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" />
  </svg>
);
export const BookIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
  </svg>
);
export const PrevIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const NextIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);
export const ClockIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const GlobeIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);
