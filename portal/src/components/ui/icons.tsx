import type { ReactNode } from "react";

/** Noms des icônes de navigation et d’interface de l’espace connecté. */
export type IconName =
  | "home"
  | "users"
  | "team"
  | "calendar"
  | "wallet"
  | "megaphone"
  | "box"
  | "settings"
  | "chat"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "sidebarCollapse"
  | "sidebarExpand"
  | "menu"
  | "close"
  | "plus"
  | "check"
  | "activity"
  | "search"
  | "share"
  | "pencil"
  | "trash"
  | "trophy"
  | "chart";

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9v10.5h12V9" />
      <path d="M10 19.5V14h4v5.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M3.5 19c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5" />
      <path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8" />
      <path d="M17.5 14.4c1.6.6 2.7 2.3 3 4.6" />
    </>
  ),
  team: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5 15.5 10l-1.3 4h-4.4L8.5 10Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="4" y="7.5" width="16.5" height="12" rx="2.5" />
      <path d="M16 13.5h1.5" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4h3l7 4.5v-13L7 10Z" />
      <path d="M18 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M7 14l1 5h2.5l-.8-4" />
    </>
  ),
  box: (
    <>
      <path d="M4 8 12 4l8 4v8l-8 4-8-4Z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
    </>
  ),
  chat: (
    <path d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25H9.3l-4.2 2.85a.75.75 0 0 1-1.2-.6Z" />
  ),
  chevronDown: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  chevronLeft: <path d="m14.5 6.5-5.5 5.5 5.5 5.5" />,
  chevronRight: <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />,
  sidebarCollapse: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9 4.5v15M15.5 10l-2 2 2 2" />
    </>
  ),
  sidebarExpand: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9 4.5v15M13.5 10l2 2-2 2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  activity: <path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  share: (
    <>
      <circle cx="17.5" cy="6" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18" r="2.5" />
      <path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6" />
    </>
  ),
  chart: <path d="M5 19V11M10 19V5M15 19v-6M20 19V9M3.5 19.5h17" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  pencil: (
    <>
      <path d="M5 19l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L9 17.5Z" />
      <path d="M13.5 7l3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7" />
      <path d="M6.5 7l1 12.5h9l1-12.5" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
};

/** Icône trait (24px, `currentColor`), décorative par défaut. */
export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
