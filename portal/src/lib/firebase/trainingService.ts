import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { getAppFirestore } from "@/lib/firebase/app";
import { Collections, Fields } from "@/lib/firebase/constants";
import {
  dateOnly,
  loadTeamsForClub,
  parseClubEvent,
  type ClubEventView,
} from "@/lib/firebase/eventService";
import {
  drillToFirestore,
  orderDrills,
  parseTrainingDrill,
  parseTrainingPlan,
  type TrainingDrill,
  type TrainingPlan,
} from "@/lib/training/trainingPlan";

/** Sous-collections des outils d’entraînement (`ProjectConfig` côté app). */
const TRAINING_PLANS = "trainingPlans";
const DRILLS = "drills";

/** Plafond de séances lues pour la bibliothèque. */
const LIBRARY_MAX_EVENTS = 40;

function plansCol(clubId: string, eventId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.events,
    eventId,
    TRAINING_PLANS,
  );
}

function drillsCol(clubId: string, eventId: string, coachUid: string) {
  return collection(plansCol(clubId, eventId), coachUid, DRILLS);
}

/**
 * Entraînements que le compte peut préparer : type `training`, au moins une
 * équipe qu’il entraîne, jamais « tout le club » (même règle que l’app et
 * que `isTrainingCoach` dans les règles Firestore).
 */
export function isCoachTraining(
  event: Pick<ClubEventView, "type" | "teamIds" | "allTeams">,
  coachTeamIds: ReadonlySet<string>,
): boolean {
  return (
    event.type === "training" &&
    !event.allTeams &&
    event.teamIds.some((teamId) => coachTeamIds.has(teamId))
  );
}

/**
 * Entraînements de mes équipes entre [start] et [end], triés par date,
 * avec le nom de leurs équipes (`teamLabels`).
 */
export async function loadCoachTrainings(params: {
  clubId: string;
  coachTeamIds: ReadonlySet<string>;
  start: Date;
  end: Date;
}): Promise<ClubEventView[]> {
  if (params.coachTeamIds.size === 0) return [];
  const teams = await loadTeamsForClub(params.clubId);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const eventsCol = collection(
    getAppFirestore(),
    Collections.clubs,
    params.clubId,
    Collections.events,
  );
  // Une requête par équipe entraînée (index `teamIds` + `date`) plutôt
  // que tout le planning du club sur la période.
  const snaps = await Promise.all(
    [...params.coachTeamIds].map((teamId) =>
      getDocs(
        query(
          eventsCol,
          where(Fields.teamIds, "array-contains", teamId),
          where(Fields.date, ">=", Timestamp.fromDate(dateOnly(params.start))),
          where(Fields.date, "<=", Timestamp.fromDate(params.end)),
          orderBy(Fields.date, "asc"),
        ),
      ),
    ),
  );
  const byId = new Map<string, ClubEventView>();
  for (const snap of snaps) {
    for (const docSnap of snap.docs) {
      if (byId.has(docSnap.id)) continue;
      const event = parseClubEvent(
        docSnap.id,
        docSnap.data() as Record<string, unknown>,
        teamNameById,
      );
      if (event && isCoachTraining(event, params.coachTeamIds)) {
        byId.set(event.id, event);
      }
    }
  }
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );
}

/** Préparation d’un coach avec ses exercices rangés. */
export type CoachPlan = {
  plan: TrainingPlan;
  drills: TrainingDrill[];
};

/** Préparations de tous les coachs d’une séance (exercices compris). */
export async function loadSessionPlans(
  clubId: string,
  eventId: string,
): Promise<CoachPlan[]> {
  const plansSnap = await getDocs(plansCol(clubId, eventId));
  return Promise.all(
    plansSnap.docs.map(async (planDoc) => {
      const plan = parseTrainingPlan(
        planDoc.id,
        planDoc.data() as Record<string, unknown>,
      );
      const drillsSnap = await getDocs(drillsCol(clubId, eventId, planDoc.id));
      const drills = drillsSnap.docs.map((drillDoc) =>
        parseTrainingDrill(drillDoc.id, drillDoc.data() as Record<string, unknown>),
      );
      return { plan, drills: orderDrills(drills, plan.drillOrder) };
    }),
  );
}

/**
 * Crée ou met à jour ma préparation (merge). [teamIds] = équipes de
 * l’entraînement, exigé tel quel par les règles.
 */
export async function saveMyPlan(params: {
  clubId: string;
  eventId: string;
  coachUid: string;
  coachName: string;
  teamIds: string[];
  notes?: string;
  drillOrder?: string[];
}): Promise<void> {
  await setDoc(
    doc(plansCol(params.clubId, params.eventId), params.coachUid),
    {
      teamIds: params.teamIds,
      coachName: params.coachName,
      ...(params.notes !== undefined ? { notes: params.notes } : {}),
      ...(params.drillOrder !== undefined
        ? { drillOrder: params.drillOrder }
        : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Nouvel identifiant d’exercice (document pas encore écrit). */
export function newDrillId(
  clubId: string,
  eventId: string,
  coachUid: string,
): string {
  return doc(drillsCol(clubId, eventId, coachUid)).id;
}

/** Écrit (remplace) l’exercice [drill] de ma préparation. */
export async function saveMyDrill(params: {
  clubId: string;
  eventId: string;
  coachUid: string;
  drill: TrainingDrill;
}): Promise<void> {
  await setDoc(
    doc(drillsCol(params.clubId, params.eventId, params.coachUid), params.drill.id),
    { ...drillToFirestore(params.drill), updatedAt: serverTimestamp() },
  );
}

/** Supprime l’exercice [drillId] de ma préparation. */
export async function deleteMyDrill(params: {
  clubId: string;
  eventId: string;
  coachUid: string;
  drillId: string;
}): Promise<void> {
  await deleteDoc(
    doc(drillsCol(params.clubId, params.eventId, params.coachUid), params.drillId),
  );
}

/** Séance passée de la bibliothèque (une préparation d’un coach). */
export type LibrarySession = {
  event: ClubEventView;
  coachUid: string;
  coachName: string;
  notes: string;
  drills: TrainingDrill[];
};

/**
 * Bibliothèque : préparations non vides (les miennes et celles des
 * collègues) des [events] fournis, plus récentes d’abord. Une séance
 * illisible est ignorée.
 */
export async function loadLibrarySessions(params: {
  clubId: string;
  events: ClubEventView[];
}): Promise<LibrarySession[]> {
  const recent = [...params.events]
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
    .slice(0, LIBRARY_MAX_EVENTS);
  const perEvent = await Promise.all(
    recent.map(async (event) => {
      try {
        const plans = await loadSessionPlans(params.clubId, event.id);
        return plans
          .filter(({ plan, drills }) => drills.length > 0 || plan.notes.trim())
          .map(
            ({ plan, drills }): LibrarySession => ({
              event,
              coachUid: plan.coachUid,
              coachName: plan.coachName,
              notes: plan.notes,
              drills,
            }),
          );
      } catch {
        return [];
      }
    }),
  );
  return perEvent.flat();
}
