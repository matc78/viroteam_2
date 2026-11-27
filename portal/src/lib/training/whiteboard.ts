/**
 * Tableau blanc d’exercice (vectoriel, coordonnées normalisées 0–1).
 * Miroir de `lib/models/whiteboard_data.dart` : même format Firestore,
 * mêmes plafonds, pour que l’app et le portail éditent les mêmes schémas.
 */

export type WhiteboardCourt = "full" | "half" | "blank";
export type WhiteboardStrokeKind = "pen" | "arrow";
export type WhiteboardInk = "accent" | "red" | "dark";
export type WhiteboardTokenKind = "player" | "opponent" | "ball";

export type WhiteboardPoint = { x: number; y: number };

export type WhiteboardStroke = {
  kind: WhiteboardStrokeKind;
  ink: WhiteboardInk;
  points: WhiteboardPoint[];
};

export type WhiteboardToken = {
  kind: WhiteboardTokenKind;
  position: WhiteboardPoint;
  /** Numéro affiché (vide pour le ballon). */
  label: string;
};

export type WhiteboardData = {
  court: WhiteboardCourt;
  strokes: WhiteboardStroke[];
  tokens: WhiteboardToken[];
};

/** Points max d’un trait après simplification. */
export const MAX_POINTS_PER_STROKE = 120;
/** Traits max par tableau. */
export const MAX_STROKES = 80;
/** Jetons max par tableau. */
export const MAX_TOKENS = 24;

export const EMPTY_BOARD: WhiteboardData = {
  court: "full",
  strokes: [],
  tokens: [],
};

/** Proportions largeur / hauteur selon le fond (comme l’app). */
export function whiteboardAspectRatio(court: WhiteboardCourt): number {
  return court === "full" ? 0.62 : 1;
}

/** True si le tableau n’a ni trait ni jeton. */
export function isBoardEmpty(board: WhiteboardData): boolean {
  return board.strokes.length === 0 && board.tokens.length === 0;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Point borné au cadre [0, 1]. */
export function clampPoint(point: WhiteboardPoint): WhiteboardPoint {
  return { x: clamp01(point.x), y: clamp01(point.y) };
}

function oneOf<T extends string>(
  raw: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return values.includes(raw as T) ? (raw as T) : fallback;
}

function parseStroke(raw: unknown): WhiteboardStroke | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.points)) return null;
  const points: WhiteboardPoint[] = [];
  for (let i = 0; i + 1 < data.points.length; i += 2) {
    const x = data.points[i];
    const y = data.points[i + 1];
    if (typeof x === "number" && typeof y === "number") {
      points.push(clampPoint({ x, y }));
    }
  }
  if (points.length < 2) return null;
  return {
    kind: oneOf(data.kind, ["pen", "arrow"] as const, "pen"),
    ink: oneOf(data.ink, ["accent", "red", "dark"] as const, "accent"),
    points,
  };
}

function parseToken(raw: unknown): WhiteboardToken | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.x !== "number" || typeof data.y !== "number") return null;
  return {
    kind: oneOf(data.kind, ["player", "opponent", "ball"] as const, "player"),
    position: clampPoint({ x: data.x, y: data.y }),
    label: typeof data.label === "string" ? data.label : "",
  };
}

/** Lit un tableau ; tableau vide si absent ou illisible. */
export function parseBoard(raw: unknown): WhiteboardData {
  if (!raw || typeof raw !== "object") return EMPTY_BOARD;
  const data = raw as Record<string, unknown>;
  return {
    court: oneOf(data.court, ["full", "half", "blank"] as const, "full"),
    strokes: Array.isArray(data.strokes)
      ? data.strokes
          .map(parseStroke)
          .filter((s): s is WhiteboardStroke => s !== null)
      : [],
    tokens: Array.isArray(data.tokens)
      ? data.tokens
          .map(parseToken)
          .filter((t): t is WhiteboardToken => t !== null)
      : [],
  };
}

/** Données Firestore d’un tableau (points à plat arrondis, plafonds appliqués). */
export function boardToFirestore(
  board: WhiteboardData,
): Record<string, unknown> {
  return {
    court: board.court,
    strokes: board.strokes.slice(0, MAX_STROKES).map((stroke) => ({
      kind: stroke.kind,
      ink: stroke.ink,
      points: simplifyPoints(stroke.points).flatMap((p) => [
        round3(p.x),
        round3(p.y),
      ]),
    })),
    tokens: board.tokens.slice(0, MAX_TOKENS).map((token) => ({
      kind: token.kind,
      x: round3(token.position.x),
      y: round3(token.position.y),
      label: token.label,
    })),
  };
}

/**
 * Réduit [points] à au plus [maxPoints] en gardant le premier et le dernier
 * (décimation régulière, comme `WhiteboardData.simplify`).
 */
export function simplifyPoints(
  points: WhiteboardPoint[],
  maxPoints = MAX_POINTS_PER_STROKE,
): WhiteboardPoint[] {
  if (points.length <= maxPoints || maxPoints < 2) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from(
    { length: maxPoints },
    (_, i) => points[Math.round(i * step)]!,
  );
}

/**
 * Nouveau jeton de [kind] : numéroté à la suite des jetons du même type,
 * posé au centre en décalé (même placement que l’app). `null` si plein.
 */
export function newToken(
  board: WhiteboardData,
  kind: WhiteboardTokenKind,
): WhiteboardToken | null {
  if (board.tokens.length >= MAX_TOKENS) return null;
  const sameKind = board.tokens.filter((token) => token.kind === kind).length;
  const offset = (sameKind % 6) * 0.06;
  return {
    kind,
    label: kind === "ball" ? "" : String(sameKind + 1),
    position: { x: 0.3 + offset, y: kind === "opponent" ? 0.3 : 0.7 },
  };
}

/** Partie d’une flèche saisie : une extrémité ou le trait entier. */
export type ArrowPart = "start" | "end" | "body";

/**
 * Flèche sous [point] (repère normalisé) pour un repère de [width] ×
 * [height] : les extrémités d’abord (rayon [handleRadius]), puis le trait
 * (distance ≤ [bodyTolerance]), de la plus récente à la plus ancienne.
 */
export function arrowAt(
  board: WhiteboardData,
  point: WhiteboardPoint,
  size: { width: number; height: number },
  handleRadius: number,
  bodyTolerance: number,
): { index: number; part: ArrowPart } | null {
  const toPx = (p: WhiteboardPoint) => ({
    x: p.x * size.width,
    y: p.y * size.height,
  });
  const target = toPx(point);
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  for (let i = board.strokes.length - 1; i >= 0; i -= 1) {
    const stroke = board.strokes[i]!;
    if (stroke.kind !== "arrow" || stroke.points.length < 2) continue;
    if (
      distance(toPx(stroke.points[stroke.points.length - 1]!), target) <=
      handleRadius
    ) {
      return { index: i, part: "end" };
    }
    if (distance(toPx(stroke.points[0]!), target) <= handleRadius) {
      return { index: i, part: "start" };
    }
  }
  for (let i = board.strokes.length - 1; i >= 0; i -= 1) {
    const stroke = board.strokes[i]!;
    if (stroke.kind !== "arrow" || stroke.points.length < 2) continue;
    for (let j = 1; j < stroke.points.length; j += 1) {
      const a = toPx(stroke.points[j - 1]!);
      const b = toPx(stroke.points[j]!);
      const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t =
        lengthSq === 0
          ? 0
          : Math.min(
              1,
              Math.max(
                0,
                ((target.x - a.x) * (b.x - a.x) +
                  (target.y - a.y) * (b.y - a.y)) /
                  lengthSq,
              ),
            );
      const closest = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      if (distance(closest, target) <= bodyTolerance) {
        return { index: i, part: "body" };
      }
    }
  }
  return null;
}

/**
 * Flèche [stroke] déplacée : une extrémité amenée en [point], ou le trait
 * entier translaté de [origin] → [point] sans sortir du schéma.
 */
export function dragArrow(
  stroke: WhiteboardStroke,
  part: ArrowPart,
  origin: WhiteboardPoint,
  point: WhiteboardPoint,
): WhiteboardStroke {
  const last = stroke.points.length - 1;
  if (part === "start" || part === "end") {
    const at = part === "start" ? 0 : last;
    return {
      ...stroke,
      points: stroke.points.map((p, index) =>
        index === at ? clampPoint(point) : p,
      ),
    };
  }
  const xs = stroke.points.map((p) => p.x);
  const ys = stroke.points.map((p) => p.y);
  const dx = Math.min(
    1 - Math.max(...xs),
    Math.max(-Math.min(...xs), point.x - origin.x),
  );
  const dy = Math.min(
    1 - Math.max(...ys),
    Math.max(-Math.min(...ys), point.y - origin.y),
  );
  return {
    ...stroke,
    points: stroke.points.map((p) => ({
      x: round3(p.x + dx),
      y: round3(p.y + dy),
    })),
  };
}
