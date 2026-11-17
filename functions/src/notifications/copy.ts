import { ANNOUNCEMENT_BODY_MAX_CHARS } from "./types";

/**
 * Copy des push : tutoiement, voix vestiaire pour les joueurs (titres en
 * rotation), plus sobre pour le staff, neutre sur cotisation / annulation /
 * annonces. Parents : titres adoucis, sans insultes.
 */

/** Longueur cible d'un titre push (écran verrouillé iOS, police système). */
const PUSH_TITLE_MAX_CHARS = 26;

/** Tronque un texte pour le corps d'une push (ajoute « … » si besoin). */
export function truncatePushBody(
  text: string,
  maxChars = ANNOUNCEMENT_BODY_MAX_CHARS,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export type PushCopy = { title: string; body: string };

/** Tirage ∈ [0, 1) injectable pour les tests. */
export type CopyRandom = () => number;

/**
 * Contexte d'une push d'événement. Les heures sont déjà au format FR
 * (« 18h00 ») ; [dayLabel] au format « jeu. 23/10 ».
 */
export type EventPushContext = {
  /** Titre de l'event : nom d'équipe (entraînement, match) ou titre libre. */
  title: string;
  type: string;
  dayLabel: string;
  startTime?: string;
  meetingTime?: string;
  location?: string;
  /** Prénom de l'enfant quand la push s'adresse à un parent. */
  childFirstName?: string;
};

/** Options de tirage (tests). */
export type CopyPickOptions = {
  random?: CopyRandom;
};

/** Statut RSVP de la personne visée (soi ou l'enfant). */
export type RsvpStatus = "yes" | "maybe" | "no" | "none";

/** Tirage uniforme dans [items] ; [random] injectable (∈ [0, 1)). */
export function pickRandom<T>(
  items: readonly T[],
  random: CopyRandom = Math.random,
): T {
  if (items.length === 0) {
    throw new Error("pickRandom: liste vide");
  }
  const index = Math.min(
    items.length - 1,
    Math.max(0, Math.floor(random() * items.length)),
  );
  return items[index]!;
}

/** Libellé FR d’un statut RSVP Firestore. */
export function rsvpStatusLabel(status: string): string {
  switch (String(status ?? "").trim()) {
    case "yes":
      return "Oui";
    case "maybe":
      return "Peut-être";
    case "no":
      return "Non";
    default:
      return "Sans réponse";
  }
}

/** Normalise un statut RSVP Firestore (inconnu = sans réponse). */
export function normalizeRsvpStatus(status: unknown): RsvpStatus {
  const value = String(status ?? "").trim();
  if (value === "yes" || value === "maybe" || value === "no") return value;
  return "none";
}

/** Libellé FR du type d’événement (« Entraînement », « Match »…). */
export function eventTypePushLabel(type: string): string {
  switch (normalizeEventType(type)) {
    case "training":
      return "Entraînement";
    case "match":
      return "Match";
    case "tournament":
      return "Tournoi";
    case "meeting":
      return "Réunion";
    default:
      return "Événement";
  }
}

/** Type d'event canonique (`training`, `match`, `tournament`, `meeting`, `other`). */
export function normalizeEventType(type: string): string {
  switch (String(type ?? "").trim().toLowerCase()) {
    case "training":
    case "entraînement":
    case "entrainement":
      return "training";
    case "match":
      return "match";
    case "tournament":
    case "tournoi":
      return "tournament";
    case "meeting":
    case "réunion":
    case "reunion":
      return "meeting";
    default:
      return "other";
  }
}

/** Type d'event précédé de son article (« l'entraînement », « la réunion »…). */
function eventTypeWithArticle(type: string): string {
  switch (normalizeEventType(type)) {
    case "training":
      return "l’entraînement";
    case "match":
      return "le match";
    case "tournament":
      return "le tournoi";
    case "meeting":
      return "la réunion";
    default:
      return "l’événement";
  }
}

/** Pluriel du type pour le récap (« 2 entraînements »). */
function eventTypeCountLabel(type: string, count: number): string {
  const plural = count > 1;
  switch (normalizeEventType(type)) {
    case "training":
      return `${count} entraînement${plural ? "s" : ""}`;
    case "match":
      return `${count} match${plural ? "s" : ""}`;
    case "tournament":
      return `${count} tournoi${plural ? "s" : ""}`;
    case "meeting":
      return `${count} réunion${plural ? "s" : ""}`;
    default:
      return `${count} événement${plural ? "s" : ""}`;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinParts(parts: Array<string | undefined>): string {
  return parts.map((part) => part?.trim() ?? "").filter(Boolean).join(" · ");
}

function rng(options?: CopyPickOptions): CopyRandom {
  return options?.random ?? Math.random;
}

/** « Entraînement jeu. 23/10 ». */
function typeDay(ctx: EventPushContext): string {
  return `${eventTypePushLabel(ctx.type)} ${ctx.dayLabel}`;
}

/** « Entraînement jeu. 23/10 à 18h00 ». */
function typeDayTime(ctx: EventPushContext): string {
  const time = ctx.startTime ? ` à ${ctx.startTime}` : "";
  return `${typeDay(ctx)}${time}`;
}

/**
 * Titre court pour les rappels / confirmations : type + jour, ou
 * « {enfant} · {type} » pour un parent (jour et équipe dans le corps).
 */
function eventHeadline(ctx: EventPushContext): string {
  const child = ctx.childFirstName?.trim();
  if (child) return fitPushTitle(`${child} · ${eventTypePushLabel(ctx.type)}`);
  return fitPushTitle(typeDay(ctx));
}

/** Titre de l'event s'il apporte une info (pas une simple répétition du type). */
function eventSubject(ctx: EventPushContext): string {
  const title = ctx.title.trim();
  if (!title) return "";
  if (title.toLowerCase() === eventTypePushLabel(ctx.type).toLowerCase()) return "";
  return title;
}

/**
 * Garde un titre sous [PUSH_TITLE_MAX_CHARS] ; sinon [fallback] ou troncature
 * avec ellipse en dernier recours.
 */
function fitPushTitle(text: string, fallback?: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= PUSH_TITLE_MAX_CHARS) return normalized;
  const safeFallback = fallback?.replace(/\s+/g, " ").trim();
  if (safeFallback && safeFallback.length <= PUSH_TITLE_MAX_CHARS) return safeFallback;
  return `${normalized.slice(0, Math.max(0, PUSH_TITLE_MAX_CHARS - 1)).trimEnd()}…`;
}

/** Équipe / titre libre + heure (+ lieu si demandé) pour le corps. */
function eventContextLine(
  ctx: EventPushContext,
  options: { includeLocation?: boolean } = {},
): string {
  return joinParts([
    eventSubject(ctx),
    ctx.startTime,
    options.includeLocation ? ctx.location : undefined,
  ]);
}

/** « Tu viens ? » ou « Léo vient ? » selon le destinataire. */
function comingQuestion(ctx: EventPushContext): string {
  const child = ctx.childFirstName?.trim();
  return child ? `${child} vient ?` : "Tu viens ?";
}

// ---------------------------------------------------------------------------
// Pools de titres (joueurs). Parents : variantes soft à part.
// ---------------------------------------------------------------------------

/** Relance manuelle — joueurs (none / maybe). */
export const MANUAL_PLAYER_TITLES = [
  "Réponds Batard !!",
  "Bismillah les ténèbres ?",
  "Abuse frérot, réponds !",
  "T ki pour me faire attendre ?",
  "Tu viens ou tu fuis ?",
  "Wesh t’es AFK ?",
  "Réponds, tête de neuille",
  "Silence = 30 burpees !",
  "Pas de rép ? 10 tours",
  "Hésite surtout pas",
] as const;

/** Relance manuelle — parents (sans insultes). */
export function manualParentTitles(childFirstName: string): string[] {
  const child = childFirstName.trim() || "ton enfant";
  return [
    `Réponds pour ${child}`,
    `${child} · toujours rien ?`,
    `Dispo de ${child} ?`,
    `Hésite pas pour ${child}`,
  ];
}

/** Nouvelle convocation — titres joueurs (hors match-only). */
export const CREATED_PLAYER_TITLES = [
  "Titulaire ?",
  "Tu kiffes le banc ou pas ?",
  "SIUUU, t’es convoqué",
  "Convoqué : Aura +1000",
  "T’es pas content ? convoqué",
] as const;

/** Titre réservé aux matchs dans la pool « nouvelle convocation ». */
export const CREATED_MATCH_ONLY_TITLE = "Ce soir c’est match !" as const;

/** Rappel J-7 sans réponse : titre + fin de corps. */
export const J7_NONE_VARIANTS: ReadonlyArray<{
  title?: string;
  titleMode?: "typeDay";
  ending: string;
}> = [
  {
    titleMode: "typeDay",
    ending: "Tu viens ? Le coach s’organise.",
  },
  {
    title: "Dans 7 jours",
    ending: "Un oui ou un non, ça change tout.",
  },
  {
    title: "J-7, réfléchis-y !",
    ending: "Marque ta dispo.",
  },
  {
    title: "Organise toi !",
    ending: "Réponds quand t’as 2 sec.",
  },
];

/** Questions J-7 « peut-être ». */
export const J7_MAYBE_ASKS = [
  "Encore en peut-être ?",
  "Tu confirmes ?",
  "On sort du flou ?",
] as const;

/** Titres J-2 sans réponse. */
export const J2_NONE_TITLES = [
  "Hésite pas frérot",
  "Fais un choix poulet",
  "Chaud ? pas chaud ?",
  "Le coach check",
  "Fais pas ton dark sasuke",
] as const;

/** Corps ancre J-2. */
export const J2_NONE_BODY_ACTION = "Hésite pas à répondre.";

/** Questions J-2 « peut-être ». */
export const J2_MAYBE_ASKS = [
  "Encore en peut-être — tu confirmes ?",
  "On fige ta place ?",
  "Oui ou non, on sort du flou.",
] as const;

/** Marqueur : titre structurel « Aujourd’hui/Demain · {type} ». */
const DAY_TITLE_STRUCTURAL = "__structural__";

/** Titres jour J (aujourd’hui), sans réponse. */
export const DAY_TODAY_NONE_TITLES = [
  DAY_TITLE_STRUCTURAL,
  "C’est aujourd’hui",
  "Fais pas le ministre !",
  "Gros tu forces là",
] as const;

/** Titres jour J (demain), sans réponse. */
export const DAY_TOMORROW_NONE_TITLES = [
  DAY_TITLE_STRUCTURAL,
  "C’est demain",
  "Fais pas le ministre !",
  "Gros tu forces là",
] as const;

/** Action jour J si pas de réponse. */
export const DAY_NONE_ACTION = "Hésite surtout pas à faire un choix.";

/** Marqueur : titre bilan = type + jour. */
const COACH_TITLE_TYPE_DAY = "__typeDay__";

/** Titres bilan coach. */
export const COACH_SUMMARY_TITLES = [
  COACH_TITLE_TYPE_DAY,
  "Point réponses",
  "Effectif",
  "Y’a du monde ?",
] as const;

/** Corps digest coéquipiers multi. */
export const TEAMMATE_DIGEST_BODIES = [
  "Jette un œil",
  "Check le planning",
] as const;

/** Fin de récap hebdo sans réponse manquante. */
export const WEEKLY_OK_ENDINGS = [
  "Tout est répondu, bonne semaine !",
  "Planning clean, go.",
] as const;

/** Rappel J-7 (events importants), pour ceux qui n'ont pas répondu. */
export function eventReminderJ7Copy(
  ctx: EventPushContext,
  options?: CopyPickOptions,
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const context = joinParts([eventSubject(ctx), ctx.location]);
  const where = context ? ` · ${context}` : "";
  const variant = pickRandom(J7_NONE_VARIANTS, rng(options));
  const title = child
    ? eventHeadline(ctx)
    : variant.titleMode === "typeDay"
      ? typeDay(ctx)
      : variant.title!;
  const ask = child ? comingQuestion(ctx) : variant.ending;
  return {
    title,
    body: `Dans une semaine${where}. ${ask}`,
  };
}

/** Rappel J-7 pour un « peut-être » encore en suspens. */
export function eventReminderJ7MaybeCopy(
  ctx: EventPushContext,
  options?: CopyPickOptions,
): PushCopy {
  const context = joinParts([eventSubject(ctx), ctx.location]);
  const where = context ? ` · ${context}` : "";
  const child = ctx.childFirstName?.trim();
  const ask = child
    ? `${child} est encore en peut-être. Tu confirmes ?`
    : pickRandom(J7_MAYBE_ASKS, rng(options));
  return {
    title: child ? eventHeadline(ctx) : pickRandom(
      ["Encore en peut-être ?", "Tu confirmes ?", "On sort du flou ?", typeDay(ctx)],
      rng(options),
    ),
    body: `Dans une semaine${where}. ${ask}`,
  };
}

/** Rappel J-2, pour ceux qui n'ont pas répondu. */
export function eventReminderJ2Copy(
  ctx: EventPushContext,
  options?: CopyPickOptions,
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const context = eventContextLine(ctx);
  const action = child
    ? `Toujours pas de réponse pour ${child}. Hésite pas à répondre.`
    : J2_NONE_BODY_ACTION;
  const title = child
    ? eventHeadline(ctx)
    : pickRandom(J2_NONE_TITLES, rng(options));
  return {
    title,
    body: context ? `${context}. ${action}` : action,
  };
}

/** Rappel J-2 pour un « peut-être » encore en suspens. */
export function eventReminderJ2MaybeCopy(
  ctx: EventPushContext,
  options?: CopyPickOptions,
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const context = eventContextLine(ctx);
  const action = child
    ? `${child} est encore en peut-être — tu confirmes ?`
    : pickRandom(J2_MAYBE_ASKS, rng(options));
  return {
    title: child ? eventHeadline(ctx) : pickRandom(
      ["Encore en peut-être ?", "On fige ta place ?", "On sort du flou"],
      rng(options),
    ),
    body: context ? `${context}. ${action}` : action,
  };
}

/**
 * Bilan des réponses pour les coachs (J-2 ou la veille au soir, selon leur
 * réglage) : décompte avant l'event.
 */
export function eventCoachSummaryCopy(
  ctx: EventPushContext & { tally: RsvpTally; when: "j2" | "eve" },
  options?: CopyPickOptions,
): PushCopy {
  const lead = ctx.when === "j2" ? "Dans 2 jours" : "Demain";
  const picked = pickRandom(COACH_SUMMARY_TITLES, rng(options));
  const title = picked === COACH_TITLE_TYPE_DAY ? typeDay(ctx) : picked;
  return {
    title,
    body: truncatePushBody(
      joinParts([lead, ctx.startTime, formatRsvpTally(ctx.tally)]),
    ),
  };
}

/**
 * Rappel du jour J (le matin, ou la veille au soir pour un event matinal),
 * pour ceux qui viennent, hésitent ou n'ont pas répondu. [tally] (coach qui
 * a choisi ce moment pour son bilan) ajoute le décompte des réponses.
 */
export function eventDayOfReminderCopy(
  ctx: EventPushContext & {
    when: "today" | "tomorrow";
    rsvp: RsvpStatus;
    tally?: RsvpTally;
  },
  options?: CopyPickOptions,
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const whenLabel = ctx.when === "today" ? "Aujourd’hui" : "Demain";
  const typeLabel = eventTypePushLabel(ctx.type);
  const structuralTitle = child
    ? fitPushTitle(
        joinParts([whenLabel, child, typeLabel]),
        `${child} · ${typeLabel}`,
      )
    : fitPushTitle(`${whenLabel} · ${typeLabel}`, typeLabel);

  const details = joinParts([
    eventSubject(ctx),
    ctx.startTime,
    ctx.meetingTime ? `RDV ${ctx.meetingTime}` : undefined,
    ctx.location,
  ]);

  if (ctx.tally) {
    return {
      title: structuralTitle,
      body: truncatePushBody(joinParts([formatRsvpTally(ctx.tally), details])),
    };
  }

  let title = structuralTitle;
  let action = "";
  if (ctx.rsvp === "none") {
    if (child) {
      action = `Hésite surtout pas à faire un choix pour ${child}.`;
    } else {
      const pool =
        ctx.when === "today" ? DAY_TODAY_NONE_TITLES : DAY_TOMORROW_NONE_TITLES;
      const picked = pickRandom(pool, rng(options));
      title = picked === DAY_TITLE_STRUCTURAL ? structuralTitle : picked;
      action =
        picked === "Fais pas le ministre !"
          ? ctx.when === "today"
            ? `Allez, un choix pour ${eventTypeWithArticle(ctx.type)} d’aujourd’hui.`
            : `Allez, un choix pour ${eventTypeWithArticle(ctx.type)} de demain.`
          : DAY_NONE_ACTION;
    }
  }
  const body = [details, action].filter(Boolean).join(". ");
  return {
    title,
    body: body || "Les détails sont dans le planning.",
  };
}

/** Nouvelle convocation (event créé à 7 jours ou moins). */
export function eventCreatedCopy(
  ctx: EventPushContext,
  options?: CopyPickOptions,
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const details = joinParts([
    typeDay(ctx),
    eventSubject(ctx),
    ctx.startTime,
    ctx.location,
  ]);
  const bodyBase = details
    ? `${details}. ${comingQuestion(ctx)}`
    : comingQuestion(ctx);

  if (child) {
    return {
      title: fitPushTitle(`Convocation · ${child}`, "Nouvelle convocation"),
      body: bodyBase,
    };
  }

  const titles: string[] = [...CREATED_PLAYER_TITLES];
  if (normalizeEventType(ctx.type) === "match") {
    titles.push(CREATED_MATCH_ONLY_TITLE);
  }
  const title = pickRandom(titles, rng(options));
  const body =
    title === CREATED_MATCH_ONLY_TITLE
      ? `${bodyBase} Confirme vite.`
      : bodyBase;
  return { title, body };
}

/** Push annulation. */
export function eventCanceledCopy(ctx: EventPushContext): PushCopy {
  const child = ctx.childFirstName?.trim();
  const typeLabel = eventTypePushLabel(ctx.type);
  const time = ctx.startTime ? ` de ${ctx.startTime}` : "";
  const sentence = `${capitalize(eventTypeWithArticle(ctx.type))}${time} n’aura pas lieu.`;
  const subject = joinParts([eventSubject(ctx), ctx.dayLabel]);
  return {
    title: child
      ? fitPushTitle(`${child} · Annulé`, `Annulé · ${typeLabel}`)
      : fitPushTitle(`Annulé · ${typeLabel}`),
    body: subject ? `${subject} — ${sentence}` : sentence,
  };
}

/**
 * Diff de planning pour la push « report » : date et / ou heure, avec les
 * anciennes valeurs déjà formatées (jour « jeu. 23/10 », heure « 18h00 »).
 */
export type EventPostponedDiff = {
  dateChanged: boolean;
  timeChanged: boolean;
  previousDayLabel?: string;
  previousStartTime?: string;
};

/** « jeu. 23/10 » ou « jeu. 23/10 à 18h00 ». */
function dayTimeLabel(dayLabel: string, startTime?: string): string {
  return startTime ? `${dayLabel} à ${startTime}` : dayLabel;
}

/**
 * Phrase du report selon ce qui a bougé :
 * - heure seule → « jeu. 23/10 — passe à 19h00 (au lieu de 18h00). »
 * - date (± heure) → « Reporté au lun. 27/10 à 18h00 (au lieu de …). »
 */
function postponedMovedSentence(
  ctx: EventPushContext & EventPostponedDiff,
): string {
  const next = dayTimeLabel(ctx.dayLabel, ctx.startTime);
  if (ctx.dateChanged) {
    const previous = ctx.previousDayLabel
      ? dayTimeLabel(
          ctx.previousDayLabel,
          ctx.timeChanged ? ctx.previousStartTime : undefined,
        )
      : undefined;
    const instead = previous ? ` (au lieu de ${previous})` : "";
    return `Reporté au ${next}${instead}.`;
  }
  if (ctx.startTime && ctx.previousStartTime) {
    return `${ctx.dayLabel} — passe à ${ctx.startTime} (au lieu de ${ctx.previousStartTime}).`;
  }
  if (ctx.startTime) {
    return `${ctx.dayLabel} — passe à ${ctx.startTime}.`;
  }
  return `Maintenant ${next}.`;
}

/** Push report : [ctx] porte la nouvelle date / heure + le diff before→after. */
export function eventPostponedCopy(
  ctx: EventPushContext & EventPostponedDiff,
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const typeLabel = eventTypePushLabel(ctx.type);
  const subject = eventSubject(ctx);
  const moved = postponedMovedSentence(ctx);
  const check = child ? `Vérifie la dispo de ${child}.` : "Vérifie ta dispo.";
  return {
    title: child
      ? fitPushTitle(`${child} · Report`, `Report · ${typeLabel}`)
      : fitPushTitle(`Report · ${typeLabel}`),
    body: `${subject ? `${subject} · ` : ""}${moved} ${check}`,
  };
}

/** Champ modifié d'un event, avec sa nouvelle valeur déjà formatée. */
export type EventFieldChange =
  | { field: "location"; value: string }
  | { field: "meetingLocation"; value: string }
  | { field: "meetingTime"; value: string }
  | { field: "endTime"; value: string }
  | { field: "title"; value: string }
  | { field: "type"; value: string }
  | { field: "matchVenue" };

function describeFieldChange(change: EventFieldChange): string {
  switch (change.field) {
    case "location":
      return change.value ? `Nouveau lieu : ${change.value}` : "Lieu mis à jour";
    case "meetingLocation":
      return change.value
        ? `Nouveau lieu de RDV : ${change.value}`
        : "Lieu de RDV mis à jour";
    case "meetingTime":
      return change.value ? `RDV à ${change.value}` : "Heure de RDV mise à jour";
    case "endTime":
      return change.value ? `Fin à ${change.value}` : "Heure de fin mise à jour";
    case "title":
      return change.value ? `Nouveau nom : ${change.value}` : "Nom mis à jour";
    case "type":
      return `C’est maintenant : ${eventTypePushLabel(change.value)}`;
    case "matchVenue":
      return "Domicile / extérieur mis à jour";
  }
}

/** Push modification : dit concrètement ce qui a changé. */
export function eventModifiedCopy(
  ctx: EventPushContext & { changes: EventFieldChange[] },
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const typeLabel = eventTypePushLabel(ctx.type);
  const described = ctx.changes.map(describeFieldChange);
  const changeLine =
    described.length > 0 ? `${described.join(" · ")}.` : "Les infos ont changé, jette un œil.";
  const context = joinParts([eventSubject(ctx), typeDay(ctx)]);
  return {
    title: child
      ? fitPushTitle(`${child} · ${typeLabel} modifié`, `${typeLabel} modifié`)
      : fitPushTitle(`${typeLabel} modifié`),
    body: truncatePushBody(context ? `${context} · ${changeLine}` : changeLine),
  };
}

/**
 * Push manuelle coach → joueurs none / maybe.
 * Corps : « Signé coach {prénom} · {type} {date} ».
 */
export function eventManualPushCopy(
  ctx: EventPushContext & {
    rsvp: RsvpStatus;
    coachFirstName?: string;
  },
  options?: CopyPickOptions,
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const coach = String(ctx.coachFirstName ?? "").trim();
  const signed = coach
    ? `Signé coach ${coach} · ${typeDay(ctx)}`
    : `Signé coach · ${typeDay(ctx)}`;
  const extras = joinParts([eventSubject(ctx), ctx.startTime, ctx.location]);
  const body = extras ? `${signed} · ${extras}` : signed;

  if (child) {
    return {
      title: pickRandom(manualParentTitles(child), rng(options)),
      body,
    };
  }
  return {
    title: pickRandom(MANUAL_PLAYER_TITLES, rng(options)),
    body,
  };
}

/**
 * Confirmation d’envoi au coach / admin qui a tapé le bouton (pas une
 * relance joueur).
 */
export function eventManualPushSentCopy(ctx: EventPushContext): PushCopy {
  return {
    title: "Notif envoyée",
    body: truncatePushBody(
      joinParts([typeDayTime(ctx), eventSubject(ctx), ctx.location]),
    ),
  };
}

/**
 * Nom court pour une push RSVP : « Prénom N. ».
 * Fallback sur displayName (même format) puis « Un membre ».
 */
export function formatMemberShortName(params: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}): string {
  const firstName = String(params.firstName ?? "").trim();
  const lastName = String(params.lastName ?? "").trim();
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
  }
  if (firstName) return firstName;

  const displayName = String(params.displayName ?? "").trim();
  if (!displayName) return "Un membre";
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    // Prénom = 1er token ; nom = le reste → initiale du début du nom (« DEL… » → D.).
    const lastNameStart = parts[1]!;
    return `${parts[0]} ${lastNameStart.charAt(0).toUpperCase()}.`;
  }
  return displayName;
}

/** Une réponse RSVP dans un digest push. */
export type RsvpDigestEntry = {
  memberName: string;
  status: string;
  /** Statut avant le changement ; utile pour signaler un retournement. */
  previousStatus?: string;
};

/** Décompte des réponses d'un event (convoqués). */
export type RsvpTally = { yes: number; no: number; maybe: number; none: number };

/** « 12 oui, 3 non, 1 peut-être, 4 sans réponse » (zéros omis sauf oui / non). */
export function formatRsvpTally(tally: RsvpTally): string {
  const parts = [`${tally.yes} oui`, `${tally.no} non`];
  if (tally.maybe > 0) parts.push(`${tally.maybe} peut-être`);
  if (tally.none > 0) parts.push(`${tally.none} sans réponse`);
  return parts.join(", ");
}

/** True si le joueur était présent et bascule en absent / peut-être. */
export function isRsvpPresenceFlip(previousStatus: string | undefined, status: string): boolean {
  return (
    normalizeRsvpStatus(previousStatus) === "yes" &&
    (normalizeRsvpStatus(status) === "no" ||
      normalizeRsvpStatus(status) === "maybe")
  );
}

/**
 * True si passage vers une présence (oui) depuis un statut connu non-oui.
 * Sans [previousStatus], on reste sur la phrase simple « X vient ».
 */
export function isRsvpJoin(
  previousStatus: string | undefined,
  status: string,
): boolean {
  if (previousStatus == null || String(previousStatus).trim() === "") {
    return false;
  }
  return (
    normalizeRsvpStatus(status) === "yes" &&
    normalizeRsvpStatus(previousStatus) !== "yes"
  );
}

/** « Marie D. vient », « Paul G. ne vient pas »… */
function rsvpSentence(name: string, status: string): string {
  switch (normalizeRsvpStatus(status)) {
    case "yes":
      return `${name} vient`;
    case "no":
      return `${name} ne vient pas`;
    case "maybe":
      return `${name} : peut-être`;
    default:
      return `${name} a retiré sa réponse`;
  }
}

/** Variantes titre RSVP staff (une réponse). */
function rsvpStaffTitle(
  name: string,
  status: string,
  previousStatus: string | undefined,
  random: CopyRandom,
): string {
  const normalized = normalizeRsvpStatus(status);
  if (isRsvpPresenceFlip(previousStatus, status)) {
    return pickRandom(
      [`${name} a basculé`, `${name} se désiste`, rsvpSentence(name, status)],
      random,
    );
  }
  if (isRsvpJoin(previousStatus, status)) {
    return pickRandom(
      [`${name} s’ajoute`, rsvpSentence(name, status)],
      random,
    );
  }
  if (
    previousStatus != null &&
    String(previousStatus).trim() !== "" &&
    normalized === "no" &&
    normalizeRsvpStatus(previousStatus) !== "no"
  ) {
    return pickRandom(
      [`${name} se désiste`, rsvpSentence(name, status)],
      random,
    );
  }
  return rsvpSentence(name, status);
}

/** Corps court pour un retournement de présence (oui → non / peut-être). */
function rsvpPresenceFlipBody(status: string): string {
  return normalizeRsvpStatus(status) === "maybe"
    ? "Passe en peut-être"
    : "Ne vient plus";
}

/**
 * Push après stabilisation d’un ou plusieurs RSVP (digest anti-spam), pour le
 * staff et les joueurs qui suivent leurs coéquipiers. Le décompte aide le
 * coach à savoir s'il a assez de monde.
 */
export function eventRsvpChangedCopy(
  params: {
    responses: RsvpDigestEntry[];
    ctx: EventPushContext;
    tally: RsvpTally;
  },
  options?: CopyPickOptions,
): PushCopy {
  const responses = params.responses.length > 0
    ? params.responses
    : [{ memberName: "Un membre", status: "none" }];
  const typeLabel = eventTypePushLabel(params.ctx.type);
  const single = responses.length === 1 ? responses[0]! : null;
  const name = single?.memberName.trim() || "Un membre";
  const flipped =
    single != null &&
    isRsvpPresenceFlip(single.previousStatus, single.status);

  const lead =
    single != null
      ? rsvpStaffTitle(name, single.status, single.previousStatus, rng(options))
      : `${responses.length} nouvelles réponses`;

  const body = flipped
    ? truncatePushBody(
        joinParts([
          `Présence : ${rsvpPresenceFlipBody(single!.status).toLowerCase()}`,
          typeDay(params.ctx),
          eventSubject(params.ctx),
        ]),
      )
    : truncatePushBody(
        joinParts([
          typeDay(params.ctx),
          eventSubject(params.ctx),
          formatRsvpTally(params.tally),
        ]),
      );

  return {
    title: fitPushTitle(lead, `Réponse · ${typeLabel}`),
    body,
  };
}

/** Entrée d’un digest multi-événements pour les coéquipiers opt-in. */
export type TeammateRsvpDigestItem = {
  responderMemberId: string;
  responderName: string;
  eventId: string;
  status: string;
  previousStatus?: string;
};

/**
 * Copy du digest coéquipiers multi-événements : une réponse = détail event ;
 * plusieurs = message court « vérifie dans l’app ».
 */
export function teammateRsvpDigestCopy(
  params: {
    items: TeammateRsvpDigestItem[];
    /** Copy détaillée quand il n’y a qu’une seule réponse (event connu). */
    singleEventCopy?: PushCopy;
  },
  options?: CopyPickOptions,
): PushCopy {
  const items = params.items;
  if (items.length <= 1) {
    return (
      params.singleEventCopy ?? {
        title: fitPushTitle("Nouvelle réponse", "Réponse"),
        body: pickRandom(TEAMMATE_DIGEST_BODIES, rng(options)),
      }
    );
  }

  const responderIds = new Set(items.map((item) => item.responderMemberId));
  const eventIds = new Set(items.map((item) => item.eventId));
  const eventCount = eventIds.size;
  const glance = pickRandom(TEAMMATE_DIGEST_BODIES, rng(options));

  if (responderIds.size === 1) {
    const name = items[0]!.responderName.trim() || "Un membre";
    const lead =
      eventCount <= 1 ? `${name} a répondu` : `${name} · ${eventCount} réponses`;
    const body =
      eventCount <= 1
        ? glance
        : `${name} a répondu à ${eventCount} convocations. ${glance}`;
    return {
      title: fitPushTitle(lead, "Réponses coéquipiers"),
      body: truncatePushBody(body),
    };
  }

  return {
    title: fitPushTitle(
      `${items.length} réponses coéquipiers`,
      "Réponses coéquipiers",
    ),
    body: glance,
  };
}

/**
 * Confirmation au parent quand la réponse de son enfant a été posée par
 * quelqu'un d'autre (autre parent, coach).
 */
export function childRsvpConfirmationCopy(params: {
  ctx: EventPushContext;
  status: string;
}): PushCopy {
  const child = params.ctx.childFirstName?.trim() || "Ton enfant";
  return {
    title: eventHeadline(params.ctx),
    body: `Réponse enregistrée pour ${child} : ${rsvpStatusLabel(params.status)}.`,
  };
}

/** Un event dans le récap hebdo d'une personne. */
export type WeeklyDigestItem = {
  type: string;
  dayLabel: string;
  /** `true` si une réponse est attendue (soi ou un enfant). */
  awaitingResponse: boolean;
};

/**
 * Récap du dimanche soir : ce qui attend la personne la semaine suivante et
 * les réponses manquantes. `null` si rien au programme (pas d'envoi).
 */
export function weeklyDigestCopy(
  items: WeeklyDigestItem[],
  options?: CopyPickOptions,
): PushCopy | null {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const item of items) {
    const type = normalizeEventType(item.type);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const order = ["match", "tournament", "training", "meeting", "other"];
  const summary = order
    .filter((type) => counts.has(type))
    .map((type) => eventTypeCountLabel(type, counts.get(type)!))
    .join(", ");

  const pendingDays = [
    ...new Set(items.filter((item) => item.awaitingResponse).map((item) => item.dayLabel)),
  ];
  const pendingCount = items.filter((item) => item.awaitingResponse).length;
  const pendingLine =
    pendingCount === 0
      ? pickRandom(WEEKLY_OK_ENDINGS, rng(options))
      : `${pendingCount} réponse${pendingCount > 1 ? "s" : ""} attendue${pendingCount > 1 ? "s" : ""} (${pendingDays.join(", ")}). Hésite pas à checker.`;
  return {
    title: "Ta semaine",
    body: truncatePushBody(`${summary}. ${pendingLine}`),
  };
}

/** Push publication d'annonce. */
export function announcementPublishedCopy(params: {
  clubName: string;
  message: string;
}): PushCopy {
  const club = params.clubName.trim();
  return {
    title: "Nouvelle annonce",
    body: truncatePushBody(club ? `${club} · ${params.message}` : params.message),
  };
}

/** Push cotisation hebdomadaire (ton neutre, pas d'humour). */
export function feeReminderCopy(params: {
  clubName: string;
  seasonLabel: string;
  deadlineLabel?: string | null;
  overdue: boolean;
}): PushCopy {
  const season = params.seasonLabel.trim();
  const club = params.clubName.trim();
  const context = joinParts([club, season ? `Saison ${season}` : undefined]);
  if (params.overdue) {
    const detail = params.deadlineLabel
      ? `Date limite dépassée (${params.deadlineLabel}). Règle-la dès que possible.`
      : "Date limite dépassée. Règle-la dès que possible.";
    return {
      title: "Cotisation en retard",
      body: truncatePushBody(context ? `${context} · ${detail}` : detail),
    };
  }
  const detail = params.deadlineLabel
    ? `À régler avant le ${params.deadlineLabel}.`
    : "Pense à régler ta cotisation.";
  return {
    title: "Cotisation à régler",
    body: truncatePushBody(context ? `${context} · ${detail}` : detail),
  };
}

/** Texte de confirmation quand on désactive une préférence. */
export function preferenceOffWarning(
  key: "events" | "announcements" | "fees" | "rsvp" | "chat" | "weeklyDigest",
): string {
  switch (key) {
    case "events":
      return "Tu ne recevras plus les rappels (J-2, jour J) ni les notifs envoyées par les coachs.";
    case "announcements":
      return "Tu ne recevras plus de notif quand le club publie une annonce.";
    case "fees":
      return "Tu ne recevras plus les rappels de cotisation.";
    case "rsvp":
      return "Tu ne recevras plus de notif quand quelqu’un répond à une convocation.";
    case "chat":
      return "Tu ne recevras plus de notif pour les nouveaux messages.";
    case "weeklyDigest":
      return "Tu ne recevras plus le récap de la semaine le dimanche soir.";
  }
}
