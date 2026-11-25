import { stringArray } from "./common";
import { isSafeMemberMapKey } from "./eventRsvpUtils";

/** Longueur max d'un message (mot au collectif ou message perso). */
export const TRAINING_MESSAGE_MAX_CHARS = 500;

/** Garde-fou : un effectif reste bien en dessous. */
export const TRAINING_MAX_PLAYER_MESSAGES = 100;

/** Bornes des notes collectives (niveau de jeu, envie / participation). */
export const TRAINING_RATING_MIN = 1;
export const TRAINING_RATING_MAX = 5;
/** Pas autorisé (demi-étoiles : 1, 1.5, …, 5). */
export const TRAINING_RATING_STEP = 0.5;

/** Retour de séance validé, prêt à écrire. */
export type TrainingFeedbackInput = {
  levelRating: number;
  engagementRating: number;
  collectiveMessage: string | null;
  /** Fiche membre → message perso (vides retirés). */
  playerMessages: Map<string, string>;
};

/** Erreur de validation (message FR affichable). */
export class TrainingFeedbackError extends Error {
  constructor(
    readonly code: "invalid-argument" | "failed-precondition",
    message: string,
  ) {
    super(message);
  }
}

function parseRating(raw: unknown, label: string): number {
  const value = typeof raw === "number" ? raw : Number.NaN;
  const halves = Math.round(value / TRAINING_RATING_STEP);
  const snapped = halves * TRAINING_RATING_STEP;
  if (
    !Number.isFinite(value) ||
    Math.abs(value - snapped) > 1e-9 ||
    snapped < TRAINING_RATING_MIN ||
    snapped > TRAINING_RATING_MAX
  ) {
    throw new TrainingFeedbackError(
      "invalid-argument",
      `${label} : une note de ${TRAINING_RATING_MIN} à ${TRAINING_RATING_MAX} (demi-étoiles) est attendue`,
    );
  }
  return snapped;
}

/** Texte nettoyé, `null` si vide ; erreur au-delà de la longueur max. */
function parseMessage(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new TrainingFeedbackError("invalid-argument", "Message invalide");
  }
  const text = raw.trim();
  if (text.length === 0) return null;
  if (text.length > TRAINING_MESSAGE_MAX_CHARS) {
    throw new TrainingFeedbackError(
      "invalid-argument",
      `Message trop long (${TRAINING_MESSAGE_MAX_CHARS} caractères max)`,
    );
  }
  return text;
}

/**
 * Valide la charge de `sendTrainingFeedback` : deux notes 1–5 (demi-étoiles)
 * obligatoires, mot au collectif et messages perso facultatifs (vides ignorés).
 */
export function parseTrainingFeedbackInput(data: unknown): TrainingFeedbackInput {
  const payload = (data ?? {}) as Record<string, unknown>;
  const levelRating = parseRating(payload.levelRating, "Niveau de jeu");
  const engagementRating = parseRating(payload.engagementRating, "Envie / participation");
  const collectiveMessage = parseMessage(payload.collectiveMessage);

  const rawMessages = payload.playerMessages;
  if (rawMessages != null && (typeof rawMessages !== "object" || Array.isArray(rawMessages))) {
    throw new TrainingFeedbackError("invalid-argument", "Messages joueurs invalides");
  }
  const playerMessages = new Map<string, string>();
  for (const [memberId, raw] of Object.entries((rawMessages ?? {}) as Record<string, unknown>)) {
    if (!isSafeMemberMapKey(memberId)) {
      throw new TrainingFeedbackError("invalid-argument", "Identifiant de membre invalide");
    }
    const message = parseMessage(raw);
    if (message) playerMessages.set(memberId, message);
  }
  if (playerMessages.size > TRAINING_MAX_PLAYER_MESSAGES) {
    throw new TrainingFeedbackError("invalid-argument", "Trop de messages en une fois");
  }
  return { levelRating, engagementRating, collectiveMessage, playerMessages };
}

/**
 * Vérifie que l'événement accepte un retour : entraînement d'équipe(s), non
 * annulé, du jour ou passé ([todayDateId] `yyyyMMdd`, Paris), et que chaque
 * destinataire d'un message perso est convoqué.
 */
export function assertTrainingFeedbackEvent(params: {
  event: Record<string, unknown>;
  todayDateId: string;
  memberIds: Iterable<string>;
}): void {
  const { event } = params;
  if (event.type !== "training") {
    throw new TrainingFeedbackError("failed-precondition", "Ce n'est pas un entraînement");
  }
  if (event.canceled === true) {
    throw new TrainingFeedbackError("failed-precondition", "Entraînement annulé");
  }
  if (event.allTeams === true || stringArray(event.teamIds).length === 0) {
    throw new TrainingFeedbackError(
      "failed-precondition",
      "Retour possible seulement sur un entraînement d'équipe",
    );
  }
  const dateId = String(event.dateId ?? "").trim();
  if (!/^\d{8}$/.test(dateId) || dateId > params.todayDateId) {
    throw new TrainingFeedbackError(
      "failed-precondition",
      "Le retour se fait une fois l'entraînement passé",
    );
  }
  const convoked = new Set(stringArray(event.teamMemberIds));
  for (const memberId of params.memberIds) {
    if (!convoked.has(memberId)) {
      throw new TrainingFeedbackError(
        "invalid-argument",
        "Un des joueurs ne fait pas partie de cet entraînement",
      );
    }
  }
}

/** Nom affiché du coach sur son retour (prénom nom, sinon nom affiché). */
export function coachDisplayName(member: Record<string, unknown> | null): string {
  if (!member) return "";
  const first = String(member.firstName ?? "").trim();
  const last = String(member.lastName ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ");
  return full || String(member.displayName ?? "").trim();
}

/**
 * Copy de la push « retour de séance » : message perso ou retour collectif,
 * pour le joueur ou son parent ([childFirstName]). [dayLabel] : « mar. 25 nov. ».
 */
export function trainingFeedbackPushCopy(params: {
  hasMessage: boolean;
  childFirstName?: string;
  dayLabel: string;
}): { title: string; body: string } {
  const child = params.childFirstName?.trim();
  const day = params.dayLabel.trim();
  const session = day ? `l'entraînement du ${day}` : "l'entraînement";
  if (child) {
    return params.hasMessage
      ? { title: `Un mot du coach pour ${child}`, body: `Retour de ${session}. Va voir ça.` }
      : { title: "Retour de séance dispo", body: `Le coach a fait le retour de ${session} de ${child}.` };
  }
  return params.hasMessage
    ? { title: "Ton coach t'a laissé un mot", body: `Retour de ${session}. Va voir ça.` }
    : { title: "Retour de séance dispo", body: `Ton coach a fait le retour de ${session}.` };
}
