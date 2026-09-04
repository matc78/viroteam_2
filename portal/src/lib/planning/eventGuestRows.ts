import type {
  ClubEventView,
  PlanningGuestDirectoryEntry,
  PlanningPersonOption,
  TeamOption,
} from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";

type RsvpRowStatus = "yes" | "no" | "pending";

/** Ligne affichée dans la liste des convoqués du popover. */
export type EventGuestRow = {
  key: string;
  name: string;
  avatarUrl: string | null;
  isCoach: boolean;
  status: RsvpRowStatus;
};

/** Construit un annuaire indexé par memberId / accountUid / matchIds. */
export function buildGuestDirectoryFromPeople(
  people: PlanningPersonOption[],
): Record<string, PlanningGuestDirectoryEntry> {
  const directory: Record<string, PlanningGuestDirectoryEntry> = {};
  for (const person of people) {
    const entry: PlanningGuestDirectoryEntry = {
      name: person.name.trim() || "Membre",
      avatarUrl: person.avatarUrl,
    };
    directory[person.id] = entry;
    for (const matchId of person.matchIds) {
      if (matchId) directory[matchId] = entry;
    }
  }
  return directory;
}

/** Construit un annuaire depuis des fiches membres (parcours famille). */
export function buildGuestDirectoryFromMembers(
  members: ClubMemberRecord[],
): Record<string, PlanningGuestDirectoryEntry> {
  const directory: Record<string, PlanningGuestDirectoryEntry> = {};
  for (const member of members) {
    const entry: PlanningGuestDirectoryEntry = {
      name: member.displayName.trim() || "Membre",
      avatarUrl: member.avatarUrl,
    };
    directory[member.memberId] = entry;
    if (member.accountUid) directory[member.accountUid] = entry;
  }
  return directory;
}

function lookupGuest(
  directory: Record<string, PlanningGuestDirectoryEntry>,
  id: string,
): PlanningGuestDirectoryEntry {
  return (
    directory[id] ?? {
      name: "Membre",
      avatarUrl: null,
    }
  );
}

function resolveRsvpForIds(
  ids: string[],
  rsvpByMemberId: Record<string, string>,
): RsvpRowStatus {
  for (const id of ids) {
    const value = (rsvpByMemberId[id] ?? "").toLowerCase();
    if (value === "yes") return "yes";
    if (value === "no") return "no";
    if (value === "maybe") return "pending";
  }
  return "pending";
}

/** Collecte memberId + accountUid (et autres alias) pointant vers la même fiche. */
function aliasIdsForGuest(
  primaryId: string,
  directory: Record<string, PlanningGuestDirectoryEntry>,
): string[] {
  const entry = directory[primaryId];
  if (!entry) return [primaryId];
  const ids = [primaryId];
  for (const [id, other] of Object.entries(directory)) {
    if (other === entry) ids.push(id);
  }
  return [...new Set(ids)];
}

/**
 * Liste des invités : coachs des équipes de l'événement en tête (alpha),
 * puis joueurs convoqués (alpha).
 */
export function buildEventGuestRows(params: {
  event: ClubEventView;
  teams: TeamOption[];
  directory: Record<string, PlanningGuestDirectoryEntry>;
}): EventGuestRow[] {
  const { event, teams, directory } = params;
  const teamById = new Map(teams.map((team) => [team.id, team]));

  const coachIds = new Set<string>();
  for (const teamId of event.teamIds) {
    const team = teamById.get(teamId);
    if (!team) continue;
    for (const coachId of team.coachIds) {
      if (coachId) coachIds.add(coachId);
    }
  }

  const coachRows: EventGuestRow[] = [];
  const seenKeys = new Set<string>();

  for (const coachId of coachIds) {
    const guest = lookupGuest(directory, coachId);
    const key = guest.name + "::coach::" + coachId;
    if (seenKeys.has(coachId) || seenKeys.has(guest.name + "::coach")) continue;
    seenKeys.add(coachId);
    seenKeys.add(guest.name + "::coach");
    coachRows.push({
      key,
      name: guest.name,
      avatarUrl: guest.avatarUrl,
      isCoach: true,
      status: resolveRsvpForIds(
        aliasIdsForGuest(coachId, directory),
        event.rsvpByMemberId,
      ),
    });
  }
  coachRows.sort((left, right) => left.name.localeCompare(right.name, "fr"));

  const playerRows: EventGuestRow[] = [];
  for (const memberId of event.teamMemberIds) {
    if (coachIds.has(memberId)) continue;
    // Évite de doubler un coach déjà listé sous un autre id (accountUid).
    const guest = lookupGuest(directory, memberId);
    const alreadyCoach = coachRows.some(
      (row) => row.name === guest.name && row.isCoach,
    );
    if (alreadyCoach) continue;
    if (seenKeys.has(memberId)) continue;
    seenKeys.add(memberId);
    playerRows.push({
      key: memberId,
      name: guest.name,
      avatarUrl: guest.avatarUrl,
      isCoach: false,
      status: resolveRsvpForIds(
        aliasIdsForGuest(memberId, directory),
        event.rsvpByMemberId,
      ),
    });
  }
  playerRows.sort((left, right) => left.name.localeCompare(right.name, "fr"));

  return [...coachRows, ...playerRows];
}
