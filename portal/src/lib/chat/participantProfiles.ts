import type { ConversationParticipant } from "@/lib/chat/conversationParticipants";
import { MemberRoles } from "@/lib/firebase/constants";
import type { ChatParticipantProfile } from "@/lib/firebase/chatTypes";

function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** Parse `participantProfiles` (map uid → profil) ; entrées invalides ignorées. */
export function parseParticipantProfiles(
  raw: unknown,
): Record<string, ChatParticipantProfile> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, ChatParticipantProfile> = {};
  for (const [uid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!uid || !value || typeof value !== "object") continue;
    const map = value as Record<string, unknown>;
    out[uid] = {
      firstName: text(map.firstName),
      lastName: text(map.lastName),
      displayName: text(map.displayName),
      avatarUrl: text(map.avatarUrl) || null,
      role: text(map.role) || MemberRoles.player,
    };
  }
  return out;
}

/** Participant affichable depuis un profil dénormalisé. */
export function participantFromProfile(
  uid: string,
  profile: ChatParticipantProfile,
): ConversationParticipant {
  const displayName =
    profile.displayName ||
    `${profile.firstName} ${profile.lastName}`.trim();
  return {
    uid,
    firstName: profile.firstName,
    displayName,
    role: profile.role,
    avatarUrl: profile.avatarUrl,
    hasLinkedAccount: true,
  };
}

/**
 * Participants couverts par les profils, et uids restant à résoudre
 * (conversation pas encore resynchronisée côté serveur).
 */
export function splitParticipantsByProfiles(params: {
  participantUids: string[];
  profiles: Record<string, ChatParticipantProfile>;
}): { fromProfiles: ConversationParticipant[]; missingUids: string[] } {
  const fromProfiles: ConversationParticipant[] = [];
  const missingUids: string[] = [];
  for (const uid of new Set(params.participantUids.filter(Boolean))) {
    const profile = params.profiles[uid];
    if (profile) fromProfiles.push(participantFromProfile(uid, profile));
    else missingUids.push(uid);
  }
  return { fromProfiles, missingUids };
}
