import type { ChatUserState } from "@/lib/firebase/chatTypes";

/** Préférences modifiables en optimiste (mute, favori). */
export type ChatStatePatch = Partial<Pick<ChatUserState, "muted" | "favorite">>;

/**
 * États chat affichés : états Firestore + préférences en cours d’écriture
 * (`patches`, clé = id du doc chatState). Un patch sans état existant crée un
 * état par défaut. Sans patch → objet d’entrée tel quel.
 */
export function applyChatStatePatches(
  states: Record<string, ChatUserState>,
  patches: Record<string, ChatStatePatch>,
): Record<string, ChatUserState> {
  const ids = Object.keys(patches);
  if (ids.length === 0) return states;
  const next = { ...states };
  for (const id of ids) {
    const base: ChatUserState = states[id] ?? {
      id,
      muted: false,
      favorite: false,
      lastReadAt: null,
      unreadCount: 0,
    };
    next[id] = { ...base, ...patches[id] };
  }
  return next;
}
