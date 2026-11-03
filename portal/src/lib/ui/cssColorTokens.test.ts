import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE_EXTENSIONS = [".css", ".ts", ".tsx"];

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))
      ? [path]
      : [];
  });
}

describe("tokens couleur CSS", () => {
  it("chaque var(--color-*) utilisée est définie quelque part", () => {
    const defined = new Set<string>();
    const usages = new Map<string, string[]>();

    for (const path of listSourceFiles(SRC_DIR)) {
      const source = readFileSync(path, "utf8");
      // Définition CSS (`--color-x:`) ou clé de style inline (`"--color-x"`).
      for (const match of source.matchAll(/(--color-[a-z0-9-]+)\s*:|["'](--color-[a-z0-9-]+)["']/g)) {
        defined.add(match[1] ?? match[2]!);
      }
      for (const match of source.matchAll(/var\((--color-[a-z0-9-]+)/g)) {
        const files = usages.get(match[1]!) ?? [];
        files.push(path.slice(SRC_DIR.length));
        usages.set(match[1]!, files);
      }
    }

    const undefinedTokens = [...usages.entries()]
      .filter(([token]) => !defined.has(token))
      .map(([token, files]) => `${token} (${[...new Set(files)].join(", ")})`);
    expect(undefinedTokens).toEqual([]);
  });
});
