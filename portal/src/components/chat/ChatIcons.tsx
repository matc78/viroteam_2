import type { ReactNode, SVGProps } from "react";

export type ChatIconName =
  | "info"
  | "search"
  | "mute"
  | "bell"
  | "favorite"
  | "favoriteFill"
  | "edit"
  | "poll"
  | "options"
  | "close"
  | "closeCircle"
  | "maximize"
  | "minimize"
  | "openPage"
  | "image"
  | "paperclip"
  | "plus"
  | "send"
  | "trash"
  | "copy"
  | "newMessage"
  | "chevronDown"
  | "chevronUp"
  | "chevronLeft"
  | "chevronRight"
  | "reply";

type ChatIconProps = {
  name: ChatIconName;
  size?: number;
  className?: string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height" | "name">;

/** Icônes outline style Phosphor pour la messagerie portal. */
export function ChatIcon({
  name,
  size = 18,
  className,
  title,
  ...rest
}: ChatIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeWidth={16}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {ICON_PATHS[name]}
    </svg>
  );
}

const ICON_PATHS: Record<ChatIconName, ReactNode> = {
  info: (
    <>
      <circle cx="128" cy="128" r="96" />
      <path d="M120 120h8v56h8" />
      <circle cx="128" cy="84" r="10" fill="currentColor" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="112" cy="112" r="72" />
      <path d="M168 168l48 48" />
    </>
  ),
  mute: (
    <>
      <path d="M96 176v8a32 32 0 0 0 64 0v-8" />
      <path d="M184 112a56 56 0 0 1-56 56h0a56 56 0 0 1-56-56V88a56 56 0 0 1 96.5-38.8" />
      <path d="M48 40l160 176" />
    </>
  ),
  bell: (
    <>
      <path d="M96 176v8a32 32 0 0 0 64 0v-8" />
      <path d="M184 112v-24a56 56 0 0 0-112 0v24c0 35.5-12.5 50-20 56h152c-7.5-6-20-20.5-20-56z" />
    </>
  ),
  favorite: (
    <path d="M128 216s-76-48-76-108a44 44 0 0 1 76-30 44 44 0 0 1 76 30c0 60-76 108-76 108z" />
  ),
  favoriteFill: (
    <path
      d="M128 216s-76-48-76-108a44 44 0 0 1 76-30 44 44 0 0 1 76 30c0 60-76 108-76 108z"
      fill="currentColor"
      stroke="none"
    />
  ),
  edit: (
    <>
      <path d="M92 204H48v-44L168 40l44 44z" />
      <path d="M136 72l48 48" />
    </>
  ),
  poll: (
    <>
      <path d="M48 208h160" />
      <path d="M72 208V120" />
      <path d="M128 208V72" />
      <path d="M184 208v-56" />
    </>
  ),
  options: (
    <>
      <circle cx="128" cy="56" r="12" fill="currentColor" stroke="none" />
      <circle cx="128" cy="128" r="12" fill="currentColor" stroke="none" />
      <circle cx="128" cy="200" r="12" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M64 64l128 128M192 64L64 192" />,
  closeCircle: (
    <>
      <circle cx="128" cy="128" r="96" />
      <path d="M160 96l-64 64M96 96l64 64" />
    </>
  ),
  maximize: (
    <>
      <path d="M144 48h64v64" />
      <path d="M208 48L128 128" />
      <path d="M112 208H48v-64" />
      <path d="M48 208l80-80" />
    </>
  ),
  minimize: (
    <>
      <path d="M80 48v48H32" />
      <path d="M32 48l64 64" />
      <path d="M176 208v-48h48" />
      <path d="M224 208l-64-64" />
    </>
  ),
  /** Carré + flèche sortante : ouvrir en page pleine. */
  openPage: (
    <>
      <path d="M160 48h48v48" />
      <path d="M208 48L112 144" />
      <path d="M176 112v80a16 16 0 0 1-16 16H64a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h80" />
    </>
  ),
  image: (
    <>
      <rect x="40" y="48" width="176" height="160" rx="16" />
      <circle cx="96" cy="104" r="20" />
      <path d="M40 160l48-40 40 32 32-24 56 48" />
    </>
  ),
  paperclip: (
    <path d="M160 80l-72 72a28 28 0 0 0 40 40l80-80a48 48 0 0 0-68-68l-84 84a68 68 0 0 0 96 96l72-72" />
  ),
  plus: (
    <>
      <path d="M128 56v144" />
      <path d="M56 128h144" />
    </>
  ),
  send: (
    <path d="M32 128l192-80-48 80 48 80zM176 128H96" />
  ),
  trash: (
    <>
      <path d="M96 96v96M128 96v96M160 96v96" />
      <path d="M48 64h160" />
      <path d="M88 64V48h80v16" />
      <path d="M72 64l8 144h96l8-144" />
    </>
  ),
  copy: (
    <>
      <rect x="72" y="72" width="112" height="128" rx="12" />
      <path d="M104 72V56a12 12 0 0 1 12-12h80a12 12 0 0 1 12 12v112a12 12 0 0 1-12 12h-16" />
    </>
  ),
  newMessage: (
    <>
      <path d="M176 48H64a16 16 0 0 0-16 16v128l32-24h96a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16z" />
      <path d="M192 24l40 40-80 80H112v-40z" />
    </>
  ),
  chevronDown: <path d="M80 104l48 48 48-48" />,
  chevronUp: <path d="M80 152l48-48 48 48" />,
  chevronLeft: <path d="M152 80l-48 48 48 48" />,
  chevronRight: <path d="M104 80l48 48-48 48" />,
  reply: (
    <>
      <path d="M88 168l-40 40V128h40z" />
      <path d="M72 128a56 56 0 0 1 96-40 56 56 0 0 1 0 80" />
    </>
  ),
};
