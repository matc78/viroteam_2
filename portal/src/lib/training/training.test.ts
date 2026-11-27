import { describe, expect, it } from "vitest";
import {
  copyDrill,
  drillDisplayTitle,
  drillToFirestore,
  moveItem,
  orderDrills,
  parseTrainingDrill,
  parseTrainingPlan,
  plannedMinutes,
  searchKey,
  sessionMinutes,
  type TrainingDrill,
} from "./trainingPlan";
import {
  boardToFirestore,
  EMPTY_BOARD,
  MAX_TOKENS,
  newToken,
  parseBoard,
  simplifyPoints,
} from "./whiteboard";

function drill(id: string, overrides: Partial<TrainingDrill> = {}): TrainingDrill {
  return {
    id,
    title: "",
    durationMin: null,
    instructions: "",
    boards: [],
    ...overrides,
  };
}

describe("whiteboard", () => {
  it("relit ce qu’il écrit (format de l’app)", () => {
    const board = {
      court: "half" as const,
      strokes: [
        {
          kind: "arrow" as const,
          ink: "red" as const,
          points: [
            { x: 0.12345, y: 0.5 },
            { x: 0.9, y: 0.1 },
          ],
        },
      ],
      tokens: [{ kind: "player" as const, label: "1", position: { x: 0.3, y: 0.7 } }],
    };
    const stored = boardToFirestore(board);
    expect((stored.strokes as Array<{ points: number[] }>)[0]!.points).toEqual([
      0.123, 0.5, 0.9, 0.1,
    ]);
    const parsed = parseBoard(stored);
    expect(parsed.court).toBe("half");
    expect(parsed.strokes[0]!.kind).toBe("arrow");
    expect(parsed.tokens[0]!.label).toBe("1");
  });

  it("ignore les traits d’un seul point et borne les coordonnées", () => {
    const parsed = parseBoard({
      strokes: [{ points: [0.1, 0.1] }, { points: [-1, 2, 0.5, 0.5] }],
      tokens: [{ x: "a", y: 1 }],
    });
    expect(parsed.strokes).toHaveLength(1);
    expect(parsed.strokes[0]!.points[0]).toEqual({ x: 0, y: 1 });
    expect(parsed.tokens).toHaveLength(0);
    expect(parseBoard(null)).toEqual(EMPTY_BOARD);
  });

  it("simplifie un trait long en gardant ses extrémités", () => {
    const points = Array.from({ length: 500 }, (_, i) => ({ x: i / 499, y: 0 }));
    const simplified = simplifyPoints(points, 120);
    expect(simplified).toHaveLength(120);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[119]).toEqual(points[499]);
  });

  it("numérote les jetons par type et refuse au-delà du plafond", () => {
    const first = newToken(EMPTY_BOARD, "player")!;
    const second = newToken({ ...EMPTY_BOARD, tokens: [first] }, "player")!;
    expect([first.label, second.label]).toEqual(["1", "2"]);
    expect(newToken(EMPTY_BOARD, "ball")!.label).toBe("");
    const full = { ...EMPTY_BOARD, tokens: Array.from({ length: MAX_TOKENS }, () => first) };
    expect(newToken(full, "opponent")).toBeNull();
  });
});

describe("trainingPlan", () => {
  it("nomme « Exo N » un exercice sans titre", () => {
    expect(drillDisplayTitle(drill("a", { title: "  " }), 2)).toBe("Exo 2");
    expect(drillDisplayTitle(drill("b", { title: " Service " }), 1)).toBe("Service");
  });

  it("lit l’ancien champ board et la durée", () => {
    const parsed = parseTrainingDrill("d1", {
      title: "Service",
      durationMin: 15.7,
      board: { court: "blank" },
    });
    expect(parsed.durationMin).toBe(15);
    expect(parsed.boards).toHaveLength(1);
    expect(parsed.boards[0]!.court).toBe("blank");
    expect(parseTrainingDrill("d2", { durationMin: 0 }).durationMin).toBeNull();
  });

  it("écrit boards (6 max) et le titre nettoyé", () => {
    const stored = drillToFirestore(
      drill("d", { title: "  Réception ", boards: Array(8).fill(EMPTY_BOARD) }),
    );
    expect(stored.title).toBe("Réception");
    expect(stored.boards).toHaveLength(6);
    expect(stored).not.toHaveProperty("board");
  });

  it("range les exercices selon drillOrder", () => {
    const ordered = orderDrills([drill("c"), drill("a"), drill("b")], ["b", "a"]);
    expect(ordered.map((d) => d.id)).toEqual(["b", "a", "c"]);
  });

  it("lit une préparation", () => {
    const plan = parseTrainingPlan("uid", { notes: "Échauffement long", drillOrder: ["x", 3] });
    expect(plan.drillOrder).toEqual(["x"]);
    expect(plan.coachName).toBe("");
  });

  it("calcule le minutage", () => {
    expect(plannedMinutes([drill("a", { durationMin: 20 }), drill("b")])).toBe(20);
    expect(sessionMinutes("2026-11-26T18:00:00Z", "2026-11-26T19:30:00Z")).toBe(90);
    expect(sessionMinutes("2026-11-26T18:00:00Z", "2026-11-26T18:00:00Z")).toBeNull();
  });

  it("déplace un élément", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });

  it("copie un exercice en profondeur sous un nouvel id", () => {
    const source = drill("a", {
      title: "Bloc",
      boards: [{ court: "full", strokes: [], tokens: [{ kind: "ball", label: "", position: { x: 0.5, y: 0.5 } }] }],
    });
    const copy = copyDrill(source, "b");
    copy.boards[0]!.tokens[0]!.position.x = 0.9;
    expect(copy.id).toBe("b");
    expect(source.boards[0]!.tokens[0]!.position.x).toBe(0.5);
  });

  it("recherche sans accents", () => {
    expect(searchKey("  Réception ")).toBe("reception");
  });
});
