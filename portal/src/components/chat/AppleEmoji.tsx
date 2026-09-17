"use client";

import { useMemo, useRef } from "react";
import {
  appleEmojiPngUrl,
  emojiToUnified,
} from "@/components/chat/emojiCatalog";
import styles from "./AppleEmoji.module.css";

type AppleEmojiProps = {
  /** Caractère emoji (ex. « 😂 ») ou id unified. */
  emoji: string;
  size?: number;
  className?: string;
  /** Si true, n’expose pas le caractère aux lecteurs d’écran. */
  decorative?: boolean;
};

function resolveUnified(emoji: string): string {
  const trimmed = emoji.trim();
  if (!trimmed) return "";
  if (/^[0-9a-f]+(?:-[0-9a-f]+)*$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return emojiToUnified(trimmed);
}

/**
 * Affiche toujours le glyph Apple (PNG CDN), jamais l’emoji système Windows/Android.
 */
export function AppleEmoji({
  emoji,
  size = 18,
  className,
  decorative = true,
}: AppleEmojiProps) {
  const unified = useMemo(() => resolveUnified(emoji), [emoji]);
  const fallbackTried = useRef(false);

  if (!unified) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={unified}
      src={appleEmojiPngUrl(unified)}
      alt={decorative ? "" : emoji}
      width={size}
      height={size}
      className={`${styles.img}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        if (fallbackTried.current) return;
        fallbackTried.current = true;
        const img = event.currentTarget;
        if (unified.endsWith("-fe0f")) {
          img.src = appleEmojiPngUrl(unified.slice(0, -5));
        } else if (!unified.includes("fe0f")) {
          img.src = appleEmojiPngUrl(`${unified}-fe0f`);
        }
      }}
    />
  );
}
