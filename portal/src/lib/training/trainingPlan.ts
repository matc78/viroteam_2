import {
  boardToFirestore,
  isBoardEmpty,
  parseBoard,
  type WhiteboardData,
} from "@/lib/training/whiteboard";

/**
 * Préparation de séance d’un coach (`events/{eventId}/trainingPlans/{uid}`
 * + `drills/{drillId}`). Miroir de `lib/models/training_plan.dart`.
 */

/** Schémas max par exercice. */
export const MAX_BOARDS = 6;

export type TrainingPlan = {
  coachUid: string;
  coachName: string;
  notes: string;
  /** Ordre des exercices (ids de `drills`). */
  drillOrder: string[];
  updatedAt: Date | null;
};

export type TrainingDrill = {
  id: string;
  title: string;
  /** Durée prévue (minutes), facultative. */
  durationMin: number | null;
  instructions: string;
  boards: WhiteboardData[];
};

/**
 * Titre affiché d’un exercice : son titre, sinon « Exo N » ([position]
 * commence à 1), comme `untitledDrill` dans l’app.
 */
export function drillDisplayTitle(
  drill: Pick<TrainingDrill, "title">,
  position: number,
): string {
  return drill.title.trim() || `Exo ${position}`;
}

function toDate(value: unknown): Date | null {
  const withToDate = value as { toDate?: () => Date } | null;
  return withToDate && typeof withToDate.toDate === "function"
    ? withToDate.toDate()
    : null;
}

/** Lit un document `trainingPlans/{coachUid}`. */
export function parseTrainingPlan(
  coachUid: string,
  data: Record<string, unknown>,
): TrainingPlan {
  return {
    coachUid,
    coachName: typeof data.coachName === "string" ? data.coachName : "",
    notes: typeof data.notes === "string" ? data.notes : "",
    drillOrder: Array.isArray(data.drillOrder)
      ? data.drillOrder.filter((id): id is string => typeof id === "string")
      : [],
    updatedAt: toDate(data.updatedAt),
  };
}

/** Lit un document `drills/{drillId}` (`boards`, ou ancien champ `board`). */
export function parseTrainingDrill(
  id: string,
  data: Record<string, unknown>,
): TrainingDrill {
  const duration = data.durationMin;
  const rawBoards = data.boards;
  const boards =
    Array.isArray(rawBoards) && rawBoards.length > 0
      ? rawBoards.slice(0, MAX_BOARDS).map(parseBoard)
      : data.board != null
        ? [parseBoard(data.board)]
        : [];
  return {
    id,
    title: typeof data.title === "string" ? data.title : "",
    durationMin:
      typeof duration === "number" && duration > 0 ? Math.trunc(duration) : null,
    instructions: typeof data.instructions === "string" ? data.instructions : "",
    boards,
  };
}

/**
 * Données Firestore d’un exercice, sans `updatedAt` (ajouté par le service).
 * Écrit `boards` ; le `set` sans merge fait disparaître l’ancien `board`.
 */
export function drillToFirestore(drill: TrainingDrill): Record<string, unknown> {
  return {
    title: drill.title.trim(),
    durationMin: drill.durationMin,
    instructions: drill.instructions,
    boards: drill.boards.slice(0, MAX_BOARDS).map(boardToFirestore),
  };
}

/** Exercices rangés selon [drillOrder] (inconnus à la fin, par id). */
export function orderDrills(
  drills: readonly TrainingDrill[],
  drillOrder: readonly string[],
): TrainingDrill[] {
  const rank = new Map(drillOrder.map((id, index) => [id, index]));
  return [...drills].sort((a, b) => {
    const ra = rank.get(a.id) ?? drillOrder.length;
    const rb = rank.get(b.id) ?? drillOrder.length;
    if (ra !== rb) return ra - rb;
    // Même ordre que l’app (`String.compareTo`, unités UTF-16).
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Total des durées prévues (exercices sans durée ignorés). */
export function plannedMinutes(drills: readonly TrainingDrill[]): number {
  return drills.reduce((total, drill) => total + (drill.durationMin ?? 0), 0);
}

/** Durée de la séance en minutes (début → fin), `null` si incohérente. */
export function sessionMinutes(startsAt: string, endsAt: string): number | null {
  const minutes = Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/** Déplace l’élément [from] en [to] (copie). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** True si l’exercice n’a rien d’utile (titre, consignes, schéma). */
export function isDrillBlank(drill: TrainingDrill): boolean {
  return (
    !drill.title.trim() &&
    !drill.instructions.trim() &&
    drill.boards.every(isBoardEmpty)
  );
}

/** Copie d’un exercice (bibliothèque) sous un nouvel [id]. */
export function copyDrill(drill: TrainingDrill, id: string): TrainingDrill {
  return {
    id,
    title: drill.title,
    durationMin: drill.durationMin,
    instructions: drill.instructions,
    boards: drill.boards.map((board) => ({
      court: board.court,
      strokes: board.strokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((point) => ({ ...point })),
      })),
      tokens: board.tokens.map((token) => ({
        ...token,
        position: { ...token.position },
      })),
    })),
  };
}

/** Clé de recherche sans accents ni casse. */
export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
