"use client";

import dynamic from "next/dynamic";
import {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";
import frEmojiData from "emoji-picker-react/dist/data/emojis-fr";
import { QUICK_REACTION_UNIFIED } from "@/components/chat/emojiCatalog";
import styles from "./AppleReactionPicker.module.css";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Chargement des émojis…</div>,
});

type AppleReactionPickerProps = {
  /** Appelé avec le caractère emoji (ex. « 👍 »). */
  onPick: (emoji: string) => void;
  /**
   * `true` : barre réactions WhatsApp (6 + « + »).
   * `false` : grille complète ouverte d’emblée.
   */
  reactionsOpen?: boolean;
  className?: string;
};

/**
 * Sélecteur d’émojis style iPhone (Apple) via emoji-picker-react.
 * Mode réactions compact + expansion vers le catalogue complet (FR).
 */
export function AppleReactionPicker({
  onPick,
  reactionsOpen = true,
  className,
}: AppleReactionPickerProps) {
  function handlePick(data: EmojiClickData) {
    const emoji = data.emoji?.trim();
    if (!emoji) return;
    onPick(emoji);
  }

  return (
    <div className={`${styles.wrap}${className ? ` ${className}` : ""}`}>
      <EmojiPicker
        reactionsDefaultOpen={reactionsOpen}
        allowExpandReactions
        reactions={[...QUICK_REACTION_UNIFIED]}
        emojiStyle={EmojiStyle.APPLE}
        theme={Theme.LIGHT}
        emojiData={frEmojiData}
        lazyLoadEmojis
        searchPlaceholder="Rechercher un emoji"
        previewConfig={{ showPreview: false }}
        skinTonesDisabled={false}
        onReactionClick={handlePick}
        onEmojiClick={handlePick}
        width="100%"
        height={reactionsOpen ? 56 : 320}
      />
    </div>
  );
}
