import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getAppFirestore } from "./app";
import {
  AnnouncementTargetTypes,
  Collections,
  Fields,
} from "./constants";
import type { ClubMemberRecord } from "./memberService";
import { toDate } from "./types";

/** Annonce club visible côté famille. */
export type ClubAnnouncementRecord = {
  id: string;
  senderFirstName: string;
  senderLastName: string;
  message: string;
  createdAt: Date | null;
  targetType: string;
  targetIds: string[];
};

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
  return false;
}

/** Charge les annonces du club filtrées pour la fiche cible. */
export async function loadAnnouncementsForMember(params: {
  clubId: string;
  member: ClubMemberRecord;
  teamCategoryById: Map<string, string>;
}): Promise<ClubAnnouncementRecord[]> {
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(
          getAppFirestore(),
          Collections.clubs,
          params.clubId,
          Collections.announcements,
        ),
        orderBy(Fields.createdAt, "desc"),
      ),
    );
  } catch {
    snap = await getDocs(
      collection(
        getAppFirestore(),
        Collections.clubs,
        params.clubId,
        Collections.announcements,
      ),
    );
  }

  return snap.docs
    .map((announcementDoc) => {
      const data = announcementDoc.data() as Record<string, unknown>;
      const targetIds = Array.isArray(data[Fields.targetIds])
        ? (data[Fields.targetIds] as unknown[]).map(String)
        : [];
      return {
        id: announcementDoc.id,
        senderFirstName: String(data[Fields.senderFirstName] ?? "").trim(),
        senderLastName: String(data[Fields.senderLastName] ?? "").trim(),
        message: String(data[Fields.message] ?? "").trim(),
        createdAt: toDate(data[Fields.createdAt]),
        targetType: String(data[Fields.targetType] ?? AnnouncementTargetTypes.allMembers),
        targetIds,
      } satisfies ClubAnnouncementRecord;
    })
    .filter((announcement) =>
      announcementMatchesMember(
        announcement,
        params.member,
        params.teamCategoryById,
      ),
    )
    .slice(0, 5);
}
