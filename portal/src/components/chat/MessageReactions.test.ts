import { describe, expect, it } from "vitest";
import {
  MAX_VISIBLE_REACTIONS,
  visibleReactionChips,
} from "./MessageReactions";

const entry = (emoji: string, count: number) => ({
  emoji,
  uids: Array.from({ length: count }, (_, i) => `u${i}`),
});

describe("visibleReactionChips", () => {
  it("garde tout sous le plafond, les plus fréquents d’abord", () => {
    const { visible, hiddenCount } = visibleReactionChips([
      entry("👍", 1),
      entry("❤️", 2),
    ]);
    expect(visible.map((e) => e.emoji)).toEqual(["❤️", "👍"]);
    expect(hiddenCount).toBe(0);
  });

  it("au-delà du plafond, compte les emojis restants (« +n »)", () => {
    const { visible, hiddenCount } = visibleReactionChips([
      entry("😀", 1),
      entry("😃", 1),
      entry("😄", 1),
      entry("😁", 1),
      entry("😆", 1),
      entry("😅", 1),
      entry("🤣", 6),
    ]);
    expect(visible).toHaveLength(MAX_VISIBLE_REACTIONS);
    expect(visible.map((e) => e.emoji)).toEqual(["🤣", "😀", "😃", "😄"]);
    expect(hiddenCount).toBe(3);
  });
});
