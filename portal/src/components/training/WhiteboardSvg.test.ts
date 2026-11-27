import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WhiteboardSvg } from "./WhiteboardSvg";
import type { WhiteboardData } from "@/lib/training/whiteboard";

function render(board: WhiteboardData): string {
  return renderToStaticMarkup(createElement(WhiteboardSvg, { board, label: "Schéma" }));
}

describe("WhiteboardSvg", () => {
  it("garde les proportions du terrain entier et dessine filet + lignes des 3 m", () => {
    const markup = render({ court: "full", strokes: [], tokens: [] });
    // 1000 / 0.62 ≈ 1612.9
    expect(markup).toMatch(/viewBox="0 0 1000 1612\.9/);
    // 2 lignes des 3 m + filet.
    expect(markup.match(/<line/g)).toHaveLength(3);
  });

  it("dessine une flèche avec un marqueur propre au SVG et les jetons numérotés", () => {
    const markup = render({
      court: "blank",
      strokes: [
        {
          kind: "arrow",
          ink: "red",
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.8, y: 0.9 },
          ],
        },
        {
          kind: "pen",
          ink: "accent",
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.3, y: 0.4 },
            { x: 0.5, y: 0.5 },
          ],
        },
      ],
      tokens: [
        { kind: "player", label: "7", position: { x: 0.5, y: 0.5 } },
        { kind: "ball", label: "", position: { x: 0.2, y: 0.8 } },
      ],
    });
    const marker = markup.match(/marker-end="url\(#([\w-]+)\)"/);
    expect(marker).not.toBeNull();
    expect(markup).toContain(`id="${marker![1]}"`);
    expect(marker![1]).toMatch(/-red$/);
    expect(markup).toContain("<polyline");
    expect(markup).toContain(">7</text>");
    expect(markup).toContain('aria-label="Schéma"');
  });
});
