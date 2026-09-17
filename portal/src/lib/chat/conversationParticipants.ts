import { PortalUiRoles } from "@/lib/firebase/constants";
import {
  listClubMembers,
  type ClubMemberRecord,
} from "@/lib/firebase/memberService";

/** Participant résolu pour preview / panneau infos. */
export type ConversationParticipant = {
  uid: string;
  firstName: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
  hasLinkedAccount: boolean;
};

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
 * Les UIDs sans fiche membre restent avec un libellé minimal.
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
    } else {
      // Participant sans fiche membre = parent (lien guardian), pas joueur.
      resolved.push({
        uid,
        firstName: "",
        displayName: "Parent",
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
