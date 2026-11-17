import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ChatBreakpoints } from "./chatBreakpoints";

const chatComponentsDir = join(__dirname, "../../components/chat");
const allowedWidths = new Set<number>(Object.values(ChatBreakpoints));

describe("points de rupture du chat", () => {
  it("les @media des modules CSS du chat utilisent ChatBreakpoints", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(chatComponentsDir)) {
      if (!file.endsWith(".module.css")) continue;
      const css = readFileSync(join(chatComponentsDir, file), "utf8");
      for (const match of css.matchAll(/@media[^{]*?(?:max|min)-width:\s*(\d+)px/g)) {
        if (!allowedWidths.has(Number(match[1]))) {
          offenders.push(`${file} : ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
