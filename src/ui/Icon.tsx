// One hand-drawn outline set: 24px grid, 1.7 stroke, round caps. Colour = currentColor.
import type { CSSProperties, ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  // navigation
  mentor: (<><path d="M4 11.5a8 7.5 0 1 1 3.9 6.4L4 19.5l1.1-3.7A7.3 7.3 0 0 1 4 11.5Z" /><circle cx="12" cy="11.5" r="2.4" /></>),
  today: (<><path d="M3 18.5h18" /><path d="M6.5 18.5a5.5 5.5 0 0 1 11 0" /><path d="M12 5.5v2.5M5.3 9.2l1.7 1.7M18.7 9.2 17 10.9M3.5 14.5h1.5M19 14.5h1.5" /></>),
  habits: (<><circle cx="12" cy="12" r="8.5" /><path d="m8.4 12.3 2.5 2.5 4.8-5.2" /></>),
  finance: (<><rect x="3.5" y="6.5" width="17" height="13" rx="3" /><path d="M6 6.5 15.4 3.9a1.5 1.5 0 0 1 1.9 1.4v1.2" /><path d="M16 13.5h1.5" /></>),
  plan: (<><rect x="3.5" y="5" width="17" height="15.5" rx="3.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M8 14h3" /></>),
  notes: (<><path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" /><path d="M14 3.5V8h4.5M9 12.5h6M9 16h4" /></>),
  reviews: (<><path d="M4 20h16M7 16.5v-4M12 16.5V7M17 16.5v-6.5" /></>),
  settings: (<><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>),
  sos: (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.5" /><path d="m6 6 3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18" /></>),
  // actions
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chevronLeft: <path d="M15 5 8 12l7 7" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5.5 9 6.5 6.5L18.5 9" />,
  chevronUp: <path d="M5.5 15 12 8.5l6.5 6.5" />,
  send: <path d="M12 19V5.5M5.5 11.5 12 5l6.5 6.5" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  more: (<><circle cx="6" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18" cy="12" r="1.2" fill="currentColor" /></>),
  menu: <path d="M4 8h16M4 16h10" />,
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>),
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" />,
  edit: (<><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 7.5 2 2" /></>),
  lock: (<><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  faceid: (<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M9 9.5V11M15 9.5V11M12 9.5v4h-1M9.2 16a4 4 0 0 0 5.6 0" /></>),
  globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5s1.1-5.9 3.5-8.5Z" /></>),
  bell: (<><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>),
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  upload: <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  grip: (<><circle cx="9" cy="6.5" r="1.1" fill="currentColor" /><circle cx="15" cy="6.5" r="1.1" fill="currentColor" /><circle cx="9" cy="12" r="1.1" fill="currentColor" /><circle cx="15" cy="12" r="1.1" fill="currentColor" /><circle cx="9" cy="17.5" r="1.1" fill="currentColor" /><circle cx="15" cy="17.5" r="1.1" fill="currentColor" /></>),
  play: <path d="M8 5.5v13l10.5-6.5Z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
  timer: (<><circle cx="12" cy="13" r="7.5" /><path d="M12 9.5V13l2.5 1.5M9.5 3h5" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  shield: <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />,
  shieldCheck: (<><path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" /><path d="m9 12 2.2 2.2L15.2 10" /></>),
  flag: <path d="M5.5 20.5v-16M5.5 4.5h11l-2 4 2 4h-11" />,
  target: (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>),
  bulb: (<><path d="M9 17.5h6M10 20.5h4" /><path d="M8.6 14.6a6 6 0 1 1 6.8 0c-.6.5-.9 1.2-.9 2v.9h-5v-.9c0-.8-.3-1.5-.9-2Z" /></>),
  tag: (<><path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0Z" /><circle cx="8" cy="8" r="1.3" /></>),
  pin: <path d="M9 4h6M10 4v5l-3 4h10l-3-4V4M12 13v7" />,
  bolt: <path d="M13 3 5 13.5h6L10.5 21 19 10.5h-6Z" />,
  moon: <path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10Z" />,
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>),
  user: (<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  logout: <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 8l-4 4 4 4M6 12h9" />,
  camera: (<><path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.5" /></>),
  image: (<><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="9.5" r="1.6" /><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 4" /></>),
  cloud: <path d="M7 18.5h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18.5Z" />,
  backspace: (<><path d="M8.5 5.5h11A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5h-11L3 12Z" /><path d="m11.5 9.5 5 5M16.5 9.5l-5 5" /></>),
  // habit presets
  water: <path d="M12 3.5c3.2 4 5.5 7.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-3 2.3-6.2 5.5-10.2Z" />,
  meals: (<><path d="M3.5 11h17M4.5 11a7.5 7.5 0 0 0 15 0M8.5 20h7" /><path d="M10 4.5c-.7.9.7 1.8 0 2.7M14 4.5c-.7.9.7 1.8 0 2.7" /></>),
  training: <path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11" />,
  guitar: (<><path d="m14 10 5.5-5.5M18 3l3 3" /><path d="M10.7 9.5a3.2 3.2 0 0 0-4.6.4c-.6.8-.5 1.6-1.3 2.2-1.7 1.2-2.4 3.5-.6 5.3s4.1 1.1 5.3-.6c.6-.8 1.4-.7 2.2-1.3a3.2 3.2 0 0 0 .4-4.6Z" /><circle cx="9" cy="15" r="1.2" /></>),
  reading: <path d="M12 6.5c-2-1.5-4.5-2-8-2v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2ZM12 6.5v13" />,
  outreach: <path d="M20.5 3.5 3.5 10.5l7 2.5 2.5 7ZM20.5 3.5l-10 9.5" />,
  learning: <path d="M2.5 9.5 12 5l9.5 4.5L12 14ZM6.5 11.5V16c3 2 8 2 11 0v-4.5M21.5 9.5v5" />,
  creating: <path d="M12 3.5 3.5 8l8.5 4.5L20.5 8ZM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />,
  brainstorm: (<><path d="M9 17.5h6M10 20.5h4" /><path d="M8.6 14.6a6 6 0 1 1 6.8 0c-.6.5-.9 1.2-.9 2v.9h-5v-.9c0-.8-.3-1.5-.9-2Z" /></>),
  // limits
  adult: <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.5.8-1.6 2.2-3.1 3.5M6.6 7.6C4.6 8.9 3.2 10.8 2.5 12c1 1.5 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  smoking: (<><rect x="2.5" y="14" width="19" height="4" rx="1" /><path d="M16.5 14v4M18 10.5c0-1.5 2-1.5 2-3.2S18 5 18 3.5" /></>),
  scroll: (<><rect x="6.5" y="2.5" width="11" height="19" rx="3" /><path d="M10.5 18.5h3" /></>),
  // finance categories
  food: <path d="M7 3.5v17M4.5 3.5v4a2.5 2.5 0 0 0 5 0v-4M17 20.5v-17c-2 1-3 3.5-3 6.5 0 2 1 3 3 3" />,
  home: (<><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" /><path d="M9.5 20.5V15h5v5.5" /></>),
  transport: (<><rect x="5" y="3.5" width="14" height="14" rx="3" /><path d="M5 11h14M8 20.5l1.5-3M16 20.5l-1.5-3" /></>),
  subs: (<><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5" /></>),
  business: (<><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></>),
  health: <path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z" />,
  fun: <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4ZM14 6v2.5M14 11v2M14 15.5V18" />,
  clothes: <path d="M8.5 4 4 6.5l1.5 4 2-.8V20h9V9.7l2 .8 1.5-4L15.5 4a3.5 3.5 0 0 1-7 0Z" />,
  invest: <path d="M3.5 17 9 11.5l3.5 3.5 8-8M15 7h5.5v5.5" />,
  other: (<><circle cx="12" cy="12" r="8.5" /><circle cx="8.5" cy="12" r=".9" fill="currentColor" /><circle cx="12" cy="12" r=".9" fill="currentColor" /><circle cx="15.5" cy="12" r=".9" fill="currentColor" /></>),
  tutoring: <path d="M2.5 9.5 12 5l9.5 4.5L12 14ZM6.5 11.5V16c3 2 8 2 11 0v-4.5M21.5 9.5v5" />,
  job: (<><rect x="4" y="5" width="16" height="14" rx="2.5" /><circle cx="9.5" cy="11" r="2" /><path d="M6.5 16a3 3 0 0 1 6 0M14.5 10h3M14.5 13.5h3" /></>),
  family: (<><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.8a3 3 0 0 1 0 5.4M17 14.2a5.5 5.5 0 0 1 3.5 4.8" /></>),
  // SOS
  breath: <path d="M3.5 9h10a2.5 2.5 0 1 0-2.5-2.5M3.5 13h14a2.5 2.5 0 1 1-2.5 2.5M3.5 17h6" />,
  door: (<><path d="M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16M4 20.5h16" /><circle cx="14.5" cy="12" r=".9" fill="currentColor" /></>),
  phone: <path d="M5 4.5h3.5l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.5 1.5C10.5 20.5 3.5 13.5 3.5 6A1.5 1.5 0 0 1 5 4.5Z" />,
  swap: <path d="M7 4.5 3.5 8 7 11.5M3.5 8h13M17 12.5l3.5 3.5-3.5 3.5M20.5 16h-13" />,
}

export type IconName = keyof typeof P

export function Icon({ name, size = 22, stroke = 1.7, style, className }: { name: IconName | string; size?: number; stroke?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
      className={className}
    >
      {P[name] ?? P.other}
    </svg>
  )
}

export const ICON_NAMES = Object.keys(P) as IconName[]
