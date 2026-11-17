import { describe, expect, it } from "vitest";
import {
  CHAT_IMAGE_MAX_HEIGHT,
  CHAT_IMAGE_MIN_HEIGHT,
  CHAT_IMAGE_WIDTH,
  messageImageAspectRatio,
  messageImageDisplayHeight,
} from "./messageImageLayout";

describe("messageImageDisplayHeight", () => {
  it("hauteur au ratio de la photo", () => {
    expect(messageImageDisplayHeight(1200, 900)).toBeCloseTo(165);
    expect(messageImageDisplayHeight(900, 1200)).toBeCloseTo(293.33, 1);
  });

  it("dimensions absentes ou invalides → carré", () => {
    expect(messageImageDisplayHeight(null, null)).toBe(CHAT_IMAGE_WIDTH);
    expect(messageImageDisplayHeight(800, 0)).toBe(CHAT_IMAGE_WIDTH);
    expect(messageImageDisplayHeight(-1, 10)).toBe(CHAT_IMAGE_WIDTH);
    expect(messageImageDisplayHeight(Number.NaN, 10)).toBe(CHAT_IMAGE_WIDTH);
    expect(messageImageDisplayHeight(undefined, 10)).toBe(CHAT_IMAGE_WIDTH);
  });

  it("ratios extrêmes bornés", () => {
    expect(messageImageDisplayHeight(100, 1000)).toBe(CHAT_IMAGE_MAX_HEIGHT);
    expect(messageImageDisplayHeight(5000, 500)).toBe(CHAT_IMAGE_MIN_HEIGHT);
  });
});

describe("messageImageAspectRatio", () => {
  it("ratio CSS largeur / hauteur arrondie", () => {
    expect(messageImageAspectRatio(1200, 900)).toBe("220 / 165");
    expect(messageImageAspectRatio(null, null)).toBe("220 / 220");
  });
});
