/**
 * Réactions rapides (unified IDs emoji-picker-react / Apple datasource).
 * 👍 ❤️ 😂 😮 😢 🙏
 */
export const QUICK_REACTIONS = [
  { emoji: "👍", unified: "1f44d" },
  { emoji: "❤️", unified: "2764-fe0f" },
  { emoji: "😂", unified: "1f602" },
  { emoji: "😮", unified: "1f62e" },
  { emoji: "😢", unified: "1f622" },
  { emoji: "🙏", unified: "1f64f" },
] as const;

export const QUICK_REACTION_UNIFIED = QUICK_REACTIONS.map((r) => r.unified);

export const QUICK_REACTION_EMOJIS = QUICK_REACTIONS.map((r) => r.emoji);

const FE0F = /\uFE0F/g;

function stripVariationSelector(value: string): string {
  return value.replace(FE0F, "");
}

/** PNG Apple (emoji-datasource) — même CDN que emoji-picker-react. */
export function appleEmojiPngUrl(unified: string): string {
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${unified}.png`;
}

/**
 * Convertit un caractère emoji → id unified (ex. « 😂 » → « 1f602 »).
 * Sert à afficher n’importe quelle réaction stockée en Firestore en PNG Apple.
 */
export function emojiToUnified(emoji: string): string {
  const trimmed = emoji.trim();
  if (!trimmed) return "";

  for (const entry of QUICK_REACTIONS) {
    if (entry.emoji === trimmed) return entry.unified;
    if (stripVariationSelector(entry.emoji) === stripVariationSelector(trimmed)) {
      return entry.unified;
    }
  }

  const parts: string[] = [];
  for (let index = 0; index < trimmed.length; ) {
    const codePoint = trimmed.codePointAt(index)!;
    parts.push(codePoint.toString(16));
    index += codePoint > 0xffff ? 2 : 1;
  }
  return parts.join("-");
}
