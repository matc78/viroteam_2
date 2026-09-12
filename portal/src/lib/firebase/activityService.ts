import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  type Transaction,
  type WriteBatch,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAppFirestore, getFirebaseApp } from "./app";
import { ClubActivityTypes, Collections, Fields } from "./constants";
import { toDate } from "./types";

/** Une entrée du journal d’activité club. */
export type ClubActivityEventRecord = {
  id: string;
  type: string;
  actorUid: string;
  actorDisplayName: string;
  createdAt: Date | null;
  count: number;
  summary: string;
  entityIds: string[];
  teamId: string | null;
  eventId: string | null;
  announcementId: string | null;
};

function activityCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.activityEvents,
  );
}

function currentActor(): { uid: string; displayName: string } {
  const user = getAuth(getFirebaseApp()).currentUser;
  if (!user) return { uid: "", displayName: "" };
  const displayName =
    user.displayName?.trim() || user.email?.trim() || "";
  return { uid: user.uid, displayName };
}

/** Construit le payload Firestore d’une entrée d’activité. */
export function buildClubActivityPayload(params: {
  type: string;
  actorUid?: string;
  actorDisplayName?: string;
  count?: number;
  summary?: string;
  entityIds?: string[];
  teamId?: string;
  eventId?: string;
  announcementId?: string;
}): Record<string, unknown> {
  const actor = currentActor();
  const count =
    params.count != null && params.count > 0 ? params.count : 1;
  const payload: Record<string, unknown> = {
    [Fields.type]: params.type,
    [Fields.actorUid]: params.actorUid ?? actor.uid,
    [Fields.actorDisplayName]:
      params.actorDisplayName ?? actor.displayName,
    [Fields.count]: count,
    [Fields.summary]: params.summary?.trim() || "",
    [Fields.createdAt]: serverTimestamp(),
  };
  if (params.entityIds && params.entityIds.length > 0) {
    payload[Fields.entityIds] = params.entityIds;
  }
  if (params.teamId) payload[Fields.teamId] = params.teamId;
  if (params.eventId) payload[Fields.eventId] = params.eventId;
  if (params.announcementId) {
    payload[Fields.announcementId] = params.announcementId;
  }
  return payload;
}

type ClubActivityWriteParams = {
  type: string;
  actorUid?: string;
  actorDisplayName?: string;
  count?: number;
  summary?: string;
  entityIds?: string[];
  teamId?: string;
  eventId?: string;
  announcementId?: string;
};

/** Ajoute une entrée dans un WriteBatch. */
export function appendClubActivityToBatch(
  batch: WriteBatch,
  clubId: string,
  params: ClubActivityWriteParams,
): void {
  const eventRef = doc(activityCol(clubId));
  batch.set(eventRef, buildClubActivityPayload(params));
}

/** Ajoute une entrée dans une Transaction. */
export function appendClubActivityToTransaction(
  tx: Transaction,
  clubId: string,
  params: ClubActivityWriteParams,
): void {
  const eventRef = doc(activityCol(clubId));
  tx.set(eventRef, buildClubActivityPayload(params));
}

/** Écrit une entrée hors batch. */
export async function logClubActivity(
  clubId: string,
  params: ClubActivityWriteParams,
): Promise<void> {
  const eventRef = doc(activityCol(clubId));
  await setDoc(eventRef, buildClubActivityPayload(params));
}

/** Titre affiché pour une entrée (libellé dérivé du type + count). */
export function clubActivityTitle(event: ClubActivityEventRecord): string {
  const n = event.count < 1 ? 1 : event.count;
  switch (event.type) {
    case "members_added":
      return n === 1 ? "1 membre ajouté" : `${n} membres ajoutés`;
    case "members_removed":
      return n === 1 ? "1 membre retiré" : `${n} membres retirés`;
    case "invitations_sent":
      return n === 1
        ? "1 invitation envoyée"
        : `${n} invitations envoyées`;
    case "events_created":
      return n === 1 ? "1 événement créé" : `${n} événements créés`;
    case "event_cancelled":
      return n === 1
        ? "1 événement annulé"
        : `${n} événements annulés`;
    case "team_created":
      return n === 1 ? "1 équipe créée" : `${n} équipes créées`;
    case "announcement_published":
      return n === 1 ? "1 annonce publiée" : `${n} annonces publiées`;
    default:
      return "Action club";
  }
}

/** Détail optionnel (nom, titre d’événement…). */
export function clubActivityDetail(
  event: ClubActivityEventRecord,
): string | null {
  const trimmed = event.summary.trim();
  return trimmed || null;
}

/** Charge le journal club (plus récent d’abord). */
export async function listClubActivity(
  clubId: string,
  max = 50,
): Promise<ClubActivityEventRecord[]> {
  const snap = await getDocs(
    query(
      activityCol(clubId),
      orderBy(Fields.createdAt, "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((eventDoc) => {
    const data = eventDoc.data() as Record<string, unknown>;
    const entityRaw = data[Fields.entityIds];
    return {
      id: eventDoc.id,
      type: String(data[Fields.type] ?? ""),
      actorUid: String(data[Fields.actorUid] ?? ""),
      actorDisplayName: String(data[Fields.actorDisplayName] ?? ""),
      createdAt: toDate(data[Fields.createdAt]),
      count: Number(data[Fields.count] ?? 1) || 1,
      summary: String(data[Fields.summary] ?? ""),
      entityIds: Array.isArray(entityRaw)
        ? entityRaw.filter((id): id is string => typeof id === "string")
        : [],
      teamId: data[Fields.teamId] ? String(data[Fields.teamId]) : null,
      eventId: data[Fields.eventId] ? String(data[Fields.eventId]) : null,
      announcementId: data[Fields.announcementId]
        ? String(data[Fields.announcementId])
        : null,
    };
  });
}

export { ClubActivityTypes };
