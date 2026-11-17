import { describe, expect, it } from "vitest";
import {
  isBureauMessagesPath,
  isFamilyMessagesPath,
  isMessagesPath,
} from "./isMessagesPath";

describe("isMessagesPath", () => {
  it("page messagerie bureau et famille, avec sous-routes", () => {
    for (const path of [
      "/messages",
      "/messages/abc",
      "/family/messages",
      "/family/messages/abc",
    ]) {
      expect(isMessagesPath(path)).toBe(true);
    }
  });

  it("pathname absent → false", () => {
    expect(isMessagesPath(null)).toBe(false);
    expect(isMessagesPath(undefined)).toBe(false);
    expect(isMessagesPath("")).toBe(false);
  });

  it("préfixes trompeurs et autres routes → false", () => {
    for (const path of [
      "/",
      "/home",
      "/messagesX",
      "/messages-old",
      "/family",
      "/family/messagesX",
      "/team/messages",
    ]) {
      expect(isMessagesPath(path)).toBe(false);
    }
  });
});

describe("isBureauMessagesPath / isFamilyMessagesPath", () => {
  it("chaque variante ne reconnaît que son espace", () => {
    expect(isBureauMessagesPath("/messages")).toBe(true);
    expect(isBureauMessagesPath("/messages/x")).toBe(true);
    expect(isBureauMessagesPath("/family/messages")).toBe(false);
    expect(isFamilyMessagesPath("/family/messages")).toBe(true);
    expect(isFamilyMessagesPath("/family/messages/x")).toBe(true);
    expect(isFamilyMessagesPath("/messages")).toBe(false);
    expect(isBureauMessagesPath(null)).toBe(false);
    expect(isFamilyMessagesPath(undefined)).toBe(false);
  });
});
