import type { ChatPreviewSender } from "@/lib/chat/conversationPreview";
import { previewSenderKey } from "@/lib/chat/conversationPreview";
import { PortalUiRoles } from "@/lib/firebase/constants";
import {
  listClubMembers,
  type ClubMemberRecord,
} from "@/lib/firebase/memberService";
import { getUserProfile } from "@/lib/firebase/userService";

/** Participant résolu pour preview / panneau infos. */
export type ConversationParticipant = {
  uid: string;
  firstName: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
  hasLinkedAccount: boolean;
};

/**
 * Construit un preview participants depuis le cache inbox (membres + pair DM).
 * Best-effort : les UIDs inconnus (ex. parents hors annuaire) restent absents
 * jusqu’à `resolveConversationParticipants`.
 */
export function seedParticipantsFromPreviewCache(params: {
  clubId: string;
  participantUids: string[];
  previewSenderByKey?: Record<string, ChatPreviewSender>;
  /** Noms profils déjà résolus (`uid` → displayName). */
  userDisplayNameByUid?: Record<string, string>;
  /** Nom complet du pair DM déjà résolu côté inbox. */
  dmPeerDisplayName?: string | null;
  viewerUid?: string | null;
}): ConversationParticipant[] {
  const uidSet = [...new Set(params.participantUids.filter(Boolean))];
  if (uidSet.length === 0) return [];

  const directory = params.previewSenderByKey ?? {};
  const profileNames = params.userDisplayNameByUid ?? {};
  const peerName = params.dmPeerDisplayName?.trim() || "";
  const peerFirst =
    peerName.split(/\s+/).filter(Boolean)[0] || peerName || "";
  const otherUids = params.viewerUid
    ? uidSet.filter((uid) => uid !== params.viewerUid)
    : uidSet;
  const isDmPair = otherUids.length === 1;

  const resolved: ConversationParticipant[] = [];
  for (const uid of uidSet) {
    const fromDir = directory[previewSenderKey(params.clubId, uid)];
    if (fromDir?.firstName.trim()) {
      const firstName = fromDir.firstName.trim();
      resolved.push({
        uid,
        firstName,
        displayName: firstName,
        role: fromDir.role || PortalUiRoles.parent,
        avatarUrl: null,
        hasLinkedAccount: true,
      });
      continue;
    }
    if (isDmPair && otherUids[0] === uid && peerFirst) {
      resolved.push({
        uid,
        firstName: peerFirst,
        displayName: peerName || peerFirst,
        role: PortalUiRoles.parent,
        avatarUrl: null,
        hasLinkedAccount: false,
      });
      continue;
    }
    const fromProfile = profileNames[uid]?.trim();
    if (fromProfile) {
      const firstName = fromProfile.split(/\s+/).filter(Boolean)[0] || fromProfile;
      resolved.push({
        uid,
        firstName,
        displayName: fromProfile,
        role: PortalUiRoles.parent,
        avatarUrl: null,
        hasLinkedAccount: false,
      });
    }
  }

  resolved.sort((a, b) =>
    participantFirstName(a).localeCompare(participantFirstName(b), "fr", {
      sensitivity: "base",
    }),
  );
  return resolved;
}

/** Prénom affiché (fallback displayName / « Membre »). */
export function participantFirstName(
  participant: Pick<ConversationParticipant, "firstName" | "displayName">,
): string {
  const first = participant.firstName.trim();
  if (first) return first;
  const fromDisplay = participant.displayName.trim().split(/\s+/)[0];
  return fromDisplay || "Membre";
}

/**
 * Résout les UIDs participants via les membres du club.
 * Les UIDs sans fiche membre (parents) sont enrichis via `users/{uid}`.
 */
export async function resolveConversationParticipants(params: {
  clubId: string;
  participantUids: string[];
}): Promise<ConversationParticipant[]> {
  const uidSet = new Set(params.participantUids.filter(Boolean));
  if (uidSet.size === 0) return [];

  const members = await listClubMembers(params.clubId);
  const byUid = new Map<string, ClubMemberRecord>();
  for (const member of members) {
    if (member.accountUid && uidSet.has(member.accountUid)) {
      byUid.set(member.accountUid, member);
    }
  }

  const missingUids = [...uidSet].filter((uid) => !byUid.has(uid));
  const profileByUid = new Map<
    string,
    { firstName: string; displayName: string; avatarUrl: string | null }
  >();
  await Promise.all(
    missingUids.map(async (uid) => {
      try {
        const profile = await getUserProfile(uid);
        if (!profile) return;
        const displayName =
          profile.displayName.trim() ||
          [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
        if (!displayName && !profile.firstName) return;
        profileByUid.set(uid, {
          firstName: profile.firstName.trim(),
          displayName: displayName || "Parent",
          avatarUrl: profile.avatarUrl,
        });
      } catch {
        // Best-effort : reste sur le libellé minimal.
      }
    }),
  );

  const resolved: ConversationParticipant[] = [];
  for (const uid of uidSet) {
    const member = byUid.get(uid);
    if (member) {
      resolved.push({
        uid,
        firstName: member.firstName,
        displayName: member.displayName,
        role: member.role,
        avatarUrl: member.avatarUrl,
        hasLinkedAccount: member.hasLinkedAccount,
      });
      continue;
    }
    const profile = profileByUid.get(uid);
    resolved.push({
      uid,
      firstName: profile?.firstName ?? "",
      displayName: profile?.displayName ?? "Parent",
      role: PortalUiRoles.parent,
      avatarUrl: profile?.avatarUrl ?? null,
      hasLinkedAccount: false,
    });
  }

  resolved.sort((a, b) =>
    participantFirstName(a).localeCompare(participantFirstName(b), "fr", {
      sensitivity: "base",
    }),
  );
  return resolved;
}

/** Preview « Prénom, Prénom, … » (tronquée). */
export function formatParticipantPreview(
  participants: ConversationParticipant[],
  maxNames = 8,
): string {
  if (participants.length === 0) return "";
  const names = participants.map(participantFirstName);
  if (names.length <= maxNames) return names.join(", ");
  return `${names.slice(0, maxNames).join(", ")}, …`;
}
