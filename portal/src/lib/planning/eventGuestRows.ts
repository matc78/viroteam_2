import type {
  ClubEventView,
  PlanningGuestDirectoryEntry,
  PlanningPersonOption,
  TeamOption,
} from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import { isAdminMember } from "@/lib/auth/permissions";

type RsvpRowStatus = "yes" | "no" | "pending";

/**
 * Badge d'une ligne RSVP : Entraîneur si coach d'une équipe de l'événement ;
 * Admin seulement sur un événement spécial (tout le club ou sans équipe).
 */
export type EventGuestBadge = "admin" | "coach";

/** Ligne affichée dans la liste des convoqués du popover. */
export type EventGuestRow = {
  key: string;
  /** Id écrit dans `events.rsvp` / callable `setEventRsvp`. */
  audienceId: string;
  name: string;
  avatarUrl: string | null;
  /** Coach d'une équipe de l'événement (groupé en tête). */
  isCoach: boolean;
  /** Badge affiché à côté du nom, `null` : aucun. */
  badge: EventGuestBadge | null;
  status: RsvpRowStatus;
};

/** Événement spécial : « Tout le club » ou aucune équipe ciblée. */
export function isSpecialEvent(
  event: Pick<ClubEventView, "allTeams" | "teamIds">,
): boolean {
  return event.allTeams === true || event.teamIds.length === 0;
}

/** Construit un annuaire indexé par id de fiche (= uid si liée). */
export function buildGuestDirectoryFromPeople(
  people: PlanningPersonOption[],
): Record<string, PlanningGuestDirectoryEntry> {
  const directory: Record<string, PlanningGuestDirectoryEntry> = {};
  for (const person of people) {
    directory[person.id] = {
      name: person.name.trim() || "Membre",
      avatarUrl: person.avatarUrl,
      isAdmin: person.badge === "admin",
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
      isAdmin: isAdminMember(member),
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
      isAdmin: false,
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
  const badge: EventGuestBadge | null =
    isSpecialEvent(event) && guest.isAdmin
      ? "admin"
      : isCoach
        ? "coach"
        : null;
  return {
    key: isCoach ? `${memberId}::coach` : memberId,
    audienceId: memberId,
    name: guest.name,
    avatarUrl: guest.avatarUrl,
    isCoach,
    badge,
    status: rsvpStatus(memberId, event.rsvpByMemberId),
  };
}

/**
 * Liste des invités : coachs des équipes de l'événement en tête (alpha),
 * puis joueurs convoqués (alpha). Un coach aussi convoqué n'apparaît qu'une
 * fois, côté coachs. Badges : voir `EventGuestBadge` (jamais Admin sur un
 * événement d'équipe).
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
