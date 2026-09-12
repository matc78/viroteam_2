import * as admin from "firebase-admin";
import { db } from "./db";

/** Types du journal d’activité club (`activity_events`). */
export const ClubActivityTypes = {
  membersAdded: "members_added",
  membersRemoved: "members_removed",
  invitationsSent: "invitations_sent",
  eventsCreated: "events_created",
  eventCancelled: "event_cancelled",
  teamCreated: "team_created",
  announcementPublished: "announcement_published",
} as const;

type LogClubActivityParams = {
  clubId: string;
  type: string;
  actorUid: string;
  actorDisplayName?: string;
  count?: number;
  summary?: string;
  entityIds?: string[];
  teamId?: string;
  eventId?: string;
  announcementId?: string;
};

/**
 * Écrit une entrée append-only dans `clubs/{clubId}/activity_events`.
 * Best-effort : les erreurs sont loguées sans faire échouer l’action métier.
 */
export async function logClubActivity(
  params: LogClubActivityParams,
): Promise<void> {
  try {
    const count = params.count != null && params.count > 0 ? params.count : 1;
    const payload: Record<string, unknown> = {
      type: params.type,
      actorUid: params.actorUid,
      actorDisplayName: params.actorDisplayName?.trim() || "",
      count,
      summary: params.summary?.trim() || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (params.entityIds && params.entityIds.length > 0) {
      payload.entityIds = params.entityIds;
    }
    if (params.teamId) payload.teamId = params.teamId;
    if (params.eventId) payload.eventId = params.eventId;
    if (params.announcementId) payload.announcementId = params.announcementId;

    await db()
      .collection("clubs")
      .doc(params.clubId)
      .collection("activity_events")
      .doc()
      .set(payload);
  } catch (error) {
    console.error("logClubActivity failed", {
      clubId: params.clubId,
      type: params.type,
      error,
    });
  }
}
