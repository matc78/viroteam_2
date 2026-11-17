"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactionPerson } from "@/components/chat/MessageReactions";
import {
  participantFirstName,
  resolveConversationParticipants,
  seedParticipantsFromPreviewCache,
  type ConversationParticipant,
} from "@/lib/chat/conversationParticipants";
import type { ChatPreviewSender } from "@/lib/chat/conversationPreview";
import { splitParticipantsByProfiles } from "@/lib/chat/participantProfiles";
import {
  isGroupConversation,
  type ChatConversation,
  type ChatParticipantProfile,
} from "@/lib/firebase/chatTypes";
import { chatCopy } from "@/lib/copy/chatCopy";

/**
 * Participants du fil : pré-remplis depuis les profils dénormalisés et les
 * caches inbox, puis résolus via l’annuaire. `participants` exclut le viewer
 * en DM (en-tête), `allParticipants` garde tout le monde.
 */
export function useThreadParticipants(params: {
  clubId: string;
  conversation: ChatConversation | null;
  viewerUid: string | undefined;
  previewSenderByKey?: Record<string, ChatPreviewSender>;
  userDisplayNameByUid?: Record<string, string>;
  inboxPeerName: string | null;
}) {
  const {
    clubId,
    conversation,
    viewerUid,
    previewSenderByKey,
    userDisplayNameByUid,
    inboxPeerName,
  } = params;
  const [participants, setParticipants] = useState<ConversationParticipant[]>(
    [],
  );
  const [allParticipants, setAllParticipants] = useState<
    ConversationParticipant[]
  >([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);

  // Clés stables : le doc conversation change à chaque snapshot (dernier message).
  const participantUidsKey = (conversation?.participantUids ?? []).join("|");
  const participantProfilesKey = useMemo(
    () => JSON.stringify(conversation?.participantProfiles ?? {}),
    [conversation?.participantProfiles],
  );
  const isDirectConversation =
    conversation != null && !isGroupConversation(conversation);

  useEffect(() => {
    const uids = participantUidsKey ? participantUidsKey.split("|") : [];
    if (uids.length === 0) {
      setParticipants([]);
      setAllParticipants([]);
      setParticipantsLoading(false);
      return;
    }

    const profiles = JSON.parse(participantProfilesKey) as Record<
      string,
      ChatParticipantProfile
    >;
    const { fromProfiles } = splitParticipantsByProfiles({
      participantUids: uids,
      profiles,
    });
    const profileUids = new Set(fromProfiles.map((participant) => participant.uid));
    const seeded = [
      ...fromProfiles,
      ...seedParticipantsFromPreviewCache({
        clubId,
        participantUids: uids,
        previewSenderByKey,
        userDisplayNameByUid,
        dmPeerDisplayName: inboxPeerName,
        viewerUid,
      }).filter((participant) => !profileUids.has(participant.uid)),
    ];
    const seededForHeader =
      isDirectConversation && viewerUid
        ? seeded.filter((participant) => participant.uid !== viewerUid)
        : seeded;
    if (seeded.length > 0) {
      setAllParticipants(seeded);
      setParticipants(seededForHeader);
    } else {
      setAllParticipants([]);
      setParticipants([]);
    }

    let cancelled = false;
    setParticipantsLoading(true);
    void resolveConversationParticipants({
      clubId,
      participantUids: uids,
      profiles,
    })
      .then((resolved) => {
        if (cancelled) return;
        setAllParticipants(resolved);
        const filtered =
          isDirectConversation && viewerUid
            ? resolved.filter((participant) => participant.uid !== viewerUid)
            : resolved;
        setParticipants(filtered);
      })
      .catch((error) => {
        // Annuaire illisible (ex. rules famille) : on garde la liste pré-remplie.
        console.warn("Participants conversation", error);
      })
      .finally(() => {
        if (!cancelled) setParticipantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    clubId,
    participantUidsKey,
    participantProfilesKey,
    isDirectConversation,
    viewerUid,
    previewSenderByKey,
    userDisplayNameByUid,
    inboxPeerName,
  ]);

  const roleByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of allParticipants) {
      map.set(participant.uid, participant.role);
    }
    return map;
  }, [allParticipants]);

  const peopleByUid = useMemo(() => {
    const map = new Map<string, ReactionPerson>();
    for (const participant of allParticipants) {
      map.set(participant.uid, {
        uid: participant.uid,
        label: participantFirstName(participant),
        displayName: participant.displayName || participantFirstName(participant),
        avatarUrl: participant.avatarUrl,
        hasLinkedAccount: participant.hasLinkedAccount,
      });
    }
    return map;
  }, [allParticipants]);

  /** Prénom affiché pour l’auteur d’un message cité (« Toi » pour le viewer). */
  function replyAuthorLabel(senderUid: string | null | undefined): string {
    if (!senderUid) return chatCopy.someone;
    if (senderUid === viewerUid) return chatCopy.replyAuthorSelf;
    const participant = allParticipants.find((person) => person.uid === senderUid);
    return participant
      ? participantFirstName(participant)
      : chatCopy.someone;
  }

  return {
    participants,
    allParticipants,
    participantsLoading,
    roleByUid,
    peopleByUid,
    replyAuthorLabel,
  };
}
