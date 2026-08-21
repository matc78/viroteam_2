import {
  addDoc,
  collection,
  deleteField,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import {
  AnnouncementTargetTypes,
  Collections,
  Fields,
} from "./constants";
import type {
  PlanningPersonOption,
  TeamOption,
} from "./eventService";
import type { ClubMemberRecord } from "./memberService";
import { toDate } from "./types";
import type { PlanningGuestSelection } from "@/lib/planning/resolveGuestAudience";
import { resolveGuestAudience } from "@/lib/planning/resolveGuestAudience";

/** Annonce club (bureau + famille). */
export type ClubAnnouncementRecord = {
  id: string;
  senderId: string;
  senderFirstName: string;
  senderLastName: string;
  message: string;
  createdAt: Date | null;
  targetType: string;
  targetIds: string[];
  endsAt: Date | null;
  closedAt: Date | null;
  closedBy: string | null;
};

/** Cible Firestore dérivée du picker d’audience. */
export type AnnouncementAudienceTarget = {
  targetType: string;
  targetIds: string[];
};

/** Indique si l’annonce est encore visible pour les destinataires. */
export function isAnnouncementActive(
  announcement: Pick<ClubAnnouncementRecord, "endsAt" | "closedAt">,
  now: Date = new Date(),
): boolean {
  if (announcement.closedAt) return false;
  if (announcement.endsAt && announcement.endsAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/** Partitionne les annonces en cours / terminées. */
export function partitionAnnouncements(
  announcements: ClubAnnouncementRecord[],
  now: Date = new Date(),
): {
  active: ClubAnnouncementRecord[];
  finished: ClubAnnouncementRecord[];
} {
  const active: ClubAnnouncementRecord[] = [];
  const finished: ClubAnnouncementRecord[] = [];
  for (const announcement of announcements) {
    if (isAnnouncementActive(announcement, now)) {
      active.push(announcement);
    } else {
      finished.push(announcement);
    }
  }
  return { active, finished };
}

/**
 * Mappe les sélections du picker vers targetType / targetIds Firestore.
 * Mélange ou personnes → résolution en memberIds (`Personnes`).
 */
export function mapGuestsToAnnouncementTarget(params: {
  allClub: boolean;
  guests: PlanningGuestSelection[];
  teams: TeamOption[];
  people: PlanningPersonOption[];
}): AnnouncementAudienceTarget {
  if (params.allClub) {
    return {
      targetType: AnnouncementTargetTypes.allMembers,
      targetIds: [],
    };
  }
  if (params.guests.length === 0) {
    throw new Error(
      "Sélectionnez au moins une cible, ou diffusez à tout le club.",
    );
  }

  const kinds = new Set(params.guests.map((guest) => guest.kind));
  const onlyTeams = kinds.size === 1 && kinds.has("team");
  const onlyCategories = kinds.size === 1 && kinds.has("category");

  if (onlyTeams) {
    return {
      targetType: AnnouncementTargetTypes.teams,
      targetIds: params.guests.map((guest) => guest.id),
    };
  }

  if (onlyCategories) {
    return {
      targetType: AnnouncementTargetTypes.categories,
      targetIds: params.guests.map((guest) => guest.id),
    };
  }

  const { teamMemberIds } = resolveGuestAudience(
    params.guests,
    params.teams,
    params.people,
  );
  return {
    targetType: AnnouncementTargetTypes.people,
    targetIds: teamMemberIds,
  };
}

function announcementMatchesMember(
  announcement: ClubAnnouncementRecord,
  member: ClubMemberRecord,
  teamCategoryById: Map<string, string>,
): boolean {
  const targetType = announcement.targetType;
  if (
    targetType === AnnouncementTargetTypes.allMembers ||
    targetType === "all"
  ) {
    return true;
  }
  if (targetType === AnnouncementTargetTypes.teams) {
    if (announcement.targetIds.length === 0) return false;
    return announcement.targetIds.some((teamId) =>
      member.teamIds.includes(teamId),
    );
  }
  if (targetType === AnnouncementTargetTypes.categories) {
    if (announcement.targetIds.length === 0) return false;
    const categories = new Set(
      member.teamIds
        .map((teamId) => teamCategoryById.get(teamId))
        .filter((category): category is string => Boolean(category)),
    );
    return announcement.targetIds.some((category) => categories.has(category));
  }
  if (targetType === AnnouncementTargetTypes.people) {
    if (announcement.targetIds.length === 0) return false;
    return announcement.targetIds.includes(member.memberId);
  }
  return false;
}

function mapAnnouncementDoc(
  announcementDoc: { id: string; data: () => Record<string, unknown> },
): ClubAnnouncementRecord {
  const data = announcementDoc.data();
  const targetIds = Array.isArray(data[Fields.targetIds])
    ? (data[Fields.targetIds] as unknown[]).map(String)
    : [];
  return {
    id: announcementDoc.id,
    senderId: String(data[Fields.senderId] ?? "").trim(),
    senderFirstName: String(data[Fields.senderFirstName] ?? "").trim(),
    senderLastName: String(data[Fields.senderLastName] ?? "").trim(),
    message: String(data[Fields.message] ?? "").trim(),
    createdAt: toDate(data[Fields.createdAt]),
    targetType: String(
      data[Fields.targetType] ?? AnnouncementTargetTypes.allMembers,
    ),
    targetIds,
    endsAt: toDate(data[Fields.endsAt]),
    closedAt: toDate(data[Fields.closedAt]),
    closedBy: data[Fields.closedBy]
      ? String(data[Fields.closedBy]).trim()
      : null,
  };
}

function announcementsCollection(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.announcements,
  );
}

/** Charge toutes les annonces du club (admin bureau), plus récentes d’abord. */
export async function loadClubAnnouncements(
  clubId: string,
): Promise<ClubAnnouncementRecord[]> {
  let snap;
  try {
    snap = await getDocs(
      query(announcementsCollection(clubId), orderBy(Fields.createdAt, "desc")),
    );
  } catch {
    snap = await getDocs(announcementsCollection(clubId));
  }

  const announcements = snap.docs.map((announcementDoc) =>
    mapAnnouncementDoc({
      id: announcementDoc.id,
      data: () => announcementDoc.data() as Record<string, unknown>,
    }),
  );
  announcements.sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });
  return announcements;
}

/** Crée une annonce club avec date limite. */
export async function createAnnouncement(params: {
  clubId: string;
  senderId: string;
  senderFirstName: string;
  senderLastName: string;
  message: string;
  targetType: string;
  targetIds: string[];
  endsAt: Date;
}): Promise<string> {
  const message = params.message.trim();
  if (!message) {
    throw new Error("Le message est obligatoire.");
  }
  if (Number.isNaN(params.endsAt.getTime())) {
    throw new Error("La date limite est invalide.");
  }

  const targetIds =
    params.targetType === AnnouncementTargetTypes.allMembers
      ? []
      : params.targetIds;

  const ref = await addDoc(announcementsCollection(params.clubId), {
    [Fields.senderId]: params.senderId,
    [Fields.senderFirstName]: params.senderFirstName.trim(),
    [Fields.senderLastName]: params.senderLastName.trim(),
    [Fields.message]: message,
    [Fields.targetType]: params.targetType,
    [Fields.targetIds]: targetIds,
    [Fields.endsAt]: Timestamp.fromDate(params.endsAt),
    [Fields.createdAt]: serverTimestamp(),
  });
  return ref.id;
}

/** Clôture manuellement une annonce en cours. */
export async function closeAnnouncement(params: {
  clubId: string;
  announcementId: string;
  closedBy: string;
}): Promise<void> {
  await updateDoc(
    doc(
      getAppFirestore(),
      Collections.clubs,
      params.clubId,
      Collections.announcements,
      params.announcementId,
    ),
    {
      [Fields.closedAt]: serverTimestamp(),
      [Fields.closedBy]: params.closedBy,
    },
  );
}

/** Retire la date limite pour laisser l’annonce ouverte jusqu’à clôture. */
export async function clearAnnouncementEndsAt(params: {
  clubId: string;
  announcementId: string;
}): Promise<void> {
  await updateDoc(
    doc(
      getAppFirestore(),
      Collections.clubs,
      params.clubId,
      Collections.announcements,
      params.announcementId,
    ),
    {
      [Fields.endsAt]: deleteField(),
    },
  );
}

/** Charge les annonces actives du club filtrées pour la fiche cible. */
export async function loadAnnouncementsForMember(params: {
  clubId: string;
  member: ClubMemberRecord;
  teamCategoryById: Map<string, string>;
}): Promise<ClubAnnouncementRecord[]> {
  const announcements = await loadClubAnnouncements(params.clubId);
  return announcements
    .filter((announcement) => isAnnouncementActive(announcement))
    .filter((announcement) =>
      announcementMatchesMember(
        announcement,
        params.member,
        params.teamCategoryById,
      ),
    )
    .slice(0, 5);
}

/** Libellé court de la cible pour l’UI bureau. */
export function announcementTargetLabel(
  announcement: ClubAnnouncementRecord,
  teamNamesById?: Map<string, string>,
): string {
  switch (announcement.targetType) {
    case AnnouncementTargetTypes.allMembers:
    case "all":
      return "Tout le club";
    case AnnouncementTargetTypes.teams: {
      if (announcement.targetIds.length === 0) return "Équipes";
      if (announcement.targetIds.length === 1 && teamNamesById) {
        return (
          teamNamesById.get(announcement.targetIds[0]!) ?? "1 équipe"
        );
      }
      return `${announcement.targetIds.length} équipe${announcement.targetIds.length > 1 ? "s" : ""}`;
    }
    case AnnouncementTargetTypes.categories: {
      if (announcement.targetIds.length === 0) return "Catégories";
      if (announcement.targetIds.length === 1) {
        return announcement.targetIds[0]!;
      }
      return `${announcement.targetIds.length} catégories`;
    }
    case AnnouncementTargetTypes.people: {
      if (announcement.targetIds.length === 0) return "Personnes";
      if (announcement.targetIds.length === 1) return "1 personne";
      return `${announcement.targetIds.length} personnes`;
    }
    default:
      return announcement.targetType;
  }
}
