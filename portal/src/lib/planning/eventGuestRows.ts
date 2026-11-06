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
  /** Id écrit dans `events.rsvp` / callable `setEventRsvp`. */
  audienceId: string;
  name: string;
  avatarUrl: string | null;
  isCoach: boolean;
  status: RsvpRowStatus;
};

/** Construit un annuaire indexé par id de fiche (= uid si liée). */
export function buildGuestDirectoryFromPeople(
  people: PlanningPersonOption[],
): Record<string, PlanningGuestDirectoryEntry> {
  const directory: Record<string, PlanningGuestDirectoryEntry> = {};
  for (const person of people) {
    directory[person.id] = {
      name: person.name.trim() || "Membre",
      avatarUrl: person.avatarUrl,
    };
  }
  return directory;
}

/** Construit un annuaire depuis des fiches membres (parcours famille). */
export function buildGuestDirectoryFromMembers(
  members: ClubMemberRecord[],
): Record<string, PlanningGuestDirectoryEntry> {
  const directory: Record<string, PlanningGuestDirectoryEntry> = {};
  for (const member of members) {
    directory[member.memberId] = {
      name: member.displayName.trim() || "Membre",
      avatarUrl: member.avatarUrl,
    };
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

function rsvpStatus(
  memberId: string,
  rsvpByMemberId: Record<string, string>,
): RsvpRowStatus {
  const value = (rsvpByMemberId[memberId] ?? "").toLowerCase();
  if (value === "yes") return "yes";
  if (value === "no") return "no";
  return "pending";
}

function guestRow(
  memberId: string,
  isCoach: boolean,
  event: ClubEventView,
  directory: Record<string, PlanningGuestDirectoryEntry>,
): EventGuestRow {
  const guest = lookupGuest(directory, memberId);
  return {
    key: isCoach ? `${memberId}::coach` : memberId,
    audienceId: memberId,
    name: guest.name,
    avatarUrl: guest.avatarUrl,
    isCoach,
    status: rsvpStatus(memberId, event.rsvpByMemberId),
  };
}

/**
 * Liste des invités : coachs des équipes de l'événement en tête (alpha),
 * puis joueurs convoqués (alpha). Un coach aussi convoqué n'apparaît qu'une
 * fois, côté coachs.
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
  const playerIds = new Set(
    event.teamMemberIds.filter((id) => Boolean(id) && !coachIds.has(id)),
  );

  const byName = (left: EventGuestRow, right: EventGuestRow) =>
    left.name.localeCompare(right.name, "fr");
  const coachRows = [...coachIds]
    .map((id) => guestRow(id, true, event, directory))
    .sort(byName);
  const playerRows = [...playerIds]
    .map((id) => guestRow(id, false, event, directory))
    .sort(byName);

  return [...coachRows, ...playerRows];
}
