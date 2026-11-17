import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import {
  Collections,
  Fields,
} from "./constants";
import {
  addAudienceToUpcomingTeamEvents,
  removeAudienceFromUpcomingTeamEvents,
  type TeamOption,
} from "./eventService";
import {
  appendClubActivityToTransaction,
  ClubActivityTypes,
} from "./activityService";

/** Rôle roster équipe (joueur ou coach). */
export type TeamRosterRole =
  | "player"
  | "coach";

function teamsCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.teams,
  );
}

function membersCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.members,
  );
}

function parseStringIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

/** Crée une équipe vide (nom + catégorie). */
export async function createTeam(params: {
  clubId: string;
  name: string;
  category: string;
}): Promise<string> {
  const trimmedName = params.name.trim();
  const trimmedCategory = params.category.trim();
  if (!trimmedName) {
    throw new Error("Le nom de l’équipe est requis.");
  }

  const teamRef = doc(teamsCol(params.clubId));
  await runTransaction(getAppFirestore(), async (tx) => {
    tx.set(teamRef, {
      [Fields.name]: trimmedName,
      [Fields.category]: trimmedCategory,
      [Fields.playerIds]: [],
      [Fields.coachIds]: [],
      [Fields.pendingPlayerIds]: [],
      [Fields.createdAt]: serverTimestamp(),
      [Fields.updatedAt]: serverTimestamp(),
    });
    appendClubActivityToTransaction(tx, params.clubId, {
      type: ClubActivityTypes.teamCreated,
      count: 1,
      summary: trimmedName,
      teamId: teamRef.id,
    });
  });
  return teamRef.id;
}

/** Met à jour le nom et/ou la catégorie d’une équipe. */
export async function updateTeam(params: {
  clubId: string;
  teamId: string;
  name?: string;
  category?: string;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    [Fields.updatedAt]: serverTimestamp(),
  };
  if (params.name !== undefined) {
    const trimmedName = params.name.trim();
    if (!trimmedName) {
      throw new Error("Le nom de l’équipe est requis.");
    }
    patch[Fields.name] = trimmedName;
  }
  if (params.category !== undefined) {
    patch[Fields.category] = params.category.trim();
  }
  await updateDoc(doc(teamsCol(params.clubId), params.teamId), patch);
}

/**
 * Ajoute un membre au roster (playerIds ou coachIds). L’id roster est l’id de
 * fiche (= uid si liée). `members.teamIds` / `coachTeamIds` sont dérivés par
 * le trigger `onTeamWritten` (jamais écrits par le client).
 */
export async function addMemberToTeam(params: {
  clubId: string;
  memberId: string;
  teamId: string;
  role: TeamRosterRole;
}): Promise<void> {
  const db = getAppFirestore();
  const teamDocument = doc(teamsCol(params.clubId), params.teamId);
  const memberDocument = doc(membersCol(params.clubId), params.memberId);
  let rosterChanged = false;

  await runTransaction(db, async (tx) => {
    const teamSnap = await tx.get(teamDocument);
    const memberSnap = await tx.get(memberDocument);
    if (!teamSnap.exists()) {
      throw new Error("Équipe introuvable.");
    }
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }

    const teamData = teamSnap.data() as Record<string, unknown>;
    const field =
      params.role === "coach" ? Fields.coachIds : Fields.playerIds;
    const currentIds = parseStringIds(teamData[field]);
    rosterChanged = !currentIds.includes(params.memberId);

    if (rosterChanged) {
      tx.update(teamDocument, {
        [field]: [...currentIds, params.memberId],
        [Fields.updatedAt]: serverTimestamp(),
      });
    }
  });

  // Joueurs et coachs sont convoqués aux events à venir (aligné Flutter).
  if (rosterChanged) {
    await addAudienceToUpcomingTeamEvents({
      clubId: params.clubId,
      teamId: params.teamId,
      audienceId: params.memberId,
    });
  }
}

/**
 * Retire un membre du roster (`members.teamIds` suit via le trigger
 * `onTeamWritten`).
 */
export async function removeMemberFromTeam(params: {
  clubId: string;
  memberId: string;
  teamId: string;
  role: TeamRosterRole;
}): Promise<void> {
  const db = getAppFirestore();
  const teamDocument = doc(teamsCol(params.clubId), params.teamId);
  const memberDocument = doc(membersCol(params.clubId), params.memberId);
  let shouldSyncAudience = false;

  await runTransaction(db, async (tx) => {
    const teamSnap = await tx.get(teamDocument);
    const memberSnap = await tx.get(memberDocument);
    if (!teamSnap.exists()) {
      throw new Error("Équipe introuvable.");
    }
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }

    const teamData = teamSnap.data() as Record<string, unknown>;
    const field =
      params.role === "coach" ? Fields.coachIds : Fields.playerIds;
    const currentIds = parseStringIds(teamData[field]);
    const nextIds = currentIds.filter((id) => id !== params.memberId);
    const rosterChanged = nextIds.length !== currentIds.length;
    tx.update(teamDocument, {
      [field]: nextIds,
      [Fields.updatedAt]: serverTimestamp(),
    });

    const playerIds = parseStringIds(
      field === Fields.playerIds ? nextIds : teamData[Fields.playerIds],
    );
    const coachIds = parseStringIds(
      field === Fields.coachIds ? nextIds : teamData[Fields.coachIds],
    );
    const stillOnTeam =
      playerIds.includes(params.memberId) || coachIds.includes(params.memberId);

    // Ne retire la convocation que si plus ni joueur ni coach.
    if (rosterChanged && !stillOnTeam) {
      shouldSyncAudience = true;
    }
  });

  if (shouldSyncAudience) {
    await removeAudienceFromUpcomingTeamEvents({
      clubId: params.clubId,
      teamId: params.teamId,
      audienceId: params.memberId,
    });
  }
}

/**
 * Supprime une équipe. Le trigger `onTeamWritten` retire son id des
 * `teamIds` / `coachTeamIds` des fiches concernées.
 */
export async function deleteTeam(params: {
  clubId: string;
  teamId: string;
}): Promise<void> {
  const teamDocument = doc(teamsCol(params.clubId), params.teamId);
  const teamSnap = await getDoc(teamDocument);
  if (!teamSnap.exists()) {
    throw new Error("Équipe introuvable.");
  }
  await deleteDoc(teamDocument);
}

/** Groupe les équipes par catégorie (libellé FR pour le vide). */
export function groupTeamsByCategory(
  teams: TeamOption[],
): { category: string; teams: TeamOption[] }[] {
  const byCategory = new Map<string, TeamOption[]>();
  for (const team of teams) {
    const category = team.category.trim() || "Sans catégorie";
    const list = byCategory.get(category) ?? [];
    list.push(team);
    byCategory.set(category, list);
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([category, categoryTeams]) => ({
      category,
      teams: [...categoryTeams].sort((a, b) =>
        a.name.localeCompare(b.name, "fr"),
      ),
    }));
}
