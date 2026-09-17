"use client";

import { useMemo, useState } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { MemberAvatar } from "@/components/dashboard/MemberAvatar";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import {
  participantFirstName,
  type ConversationParticipant,
} from "@/lib/chat/conversationParticipants";
import {
  pollUniqueVoterCount,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";
import infoStyles from "./ConversationInfoPanel.module.css";
import styles from "./PollVotesPanel.module.css";

type PollVotesPanelProps = {
  message: ChatMessage;
  participants: ConversationParticipant[];
  participantCount: number;
  onClose: () => void;
};

/**
 * Panneau détails sondage (même slot que infos groupe) : votants par option.
 */
export function PollVotesPanel({
  message,
  participants,
  participantCount,
  onClose,
}: PollVotesPanelProps) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const peopleByUid = useMemo(() => {
    const map = new Map<string, ConversationParticipant>();
    for (const participant of participants) {
      map.set(participant.uid, participant);
    }
    return map;
  }, [participants]);

  const question = (message.pollQuestion || message.text || "").trim();
  const voted = pollUniqueVoterCount(message);

  const selected = selectedUid
    ? peopleByUid.get(selectedUid) ?? null
    : null;

  if (selected) {
    return (
      <aside className={infoStyles.panel} aria-label="Fiche membre">
        <header className={infoStyles.header}>
          <button
            type="button"
            className={infoStyles.headerIconBtn}
            aria-label="Retour"
            onClick={() => setSelectedUid(null)}
          >
            <ChatIcon name="close" size={20} />
          </button>
          <h2 className={infoStyles.headerTitle}>Infos du contact</h2>
        </header>
        <div className={infoStyles.memberDetail}>
          <MemberAvatar
            displayName={selected.displayName}
            avatarUrl={selected.avatarUrl}
            hasLinkedAccount={selected.hasLinkedAccount}
            size="md"
          />
          <h3 className={infoStyles.memberName}>{selected.displayName}</h3>
          <RoleBadge role={selected.role} size="sm" />
        </div>
      </aside>
    );
  }

  return (
    <aside className={infoStyles.panel} aria-label="Détails du sondage">
      <header className={infoStyles.header}>
        <button
          type="button"
          className={infoStyles.headerIconBtn}
          aria-label="Fermer"
          onClick={onClose}
        >
          <ChatIcon name="close" size={20} />
        </button>
        <h2 className={infoStyles.headerTitle}>Détails du sondage</h2>
      </header>

      <div className={infoStyles.scrollBody}>
        <div className={styles.hero}>
          <h3 className={styles.question}>{question || "Sondage"}</h3>
          <p className={styles.mode}>
            {message.pollAllowMultiple
              ? "Plusieurs réponses possibles"
              : "Réponse unique"}
          </p>
          <p className={styles.summary}>
            Membres ayant voté : {voted} sur {participantCount}
          </p>
        </div>

        {voted === 0 ? (
          <p className={infoStyles.emptyPad}>Personne n’a encore voté.</p>
        ) : (
          message.pollOptions.map((option) => {
            const voterUids = message.pollVotes[option.id] ?? [];
            const count = voterUids.length;
            return (
              <section key={option.id} className={infoStyles.block}>
                <div className={styles.optionHeader}>
                  <h4 className={styles.optionTitle}>{option.text}</h4>
                  <span className={styles.voteBadge}>
                    {count <= 1 ? `${count} vote` : `${count} votes`}
                  </span>
                </div>
                {count === 0 ? (
                  <p className={styles.emptyOption}>Aucun vote</p>
                ) : (
                  <ul className={infoStyles.memberList}>
                    {voterUids.map((uid) => {
                      const person = peopleByUid.get(uid);
                      const label = person
                        ? participantFirstName(person)
                        : "Membre";
                      return (
                        <li key={`${option.id}-${uid}`}>
                          <button
                            type="button"
                            className={infoStyles.memberRow}
                            onClick={() => setSelectedUid(uid)}
                            disabled={!person}
                          >
                            <MemberAvatar
                              displayName={person?.displayName || label}
                              avatarUrl={person?.avatarUrl}
                              hasLinkedAccount={
                                person?.hasLinkedAccount ?? false
                              }
                              size="sm"
                              enableZoom={false}
                            />
                            <span className={infoStyles.memberRowText}>
                              <span className={infoStyles.memberFirst}>
                                {label}
                              </span>
                            </span>
                            {person ? (
                              <RoleBadge
                                role={person.role}
                                size="sm"
                                iconOnly
                              />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </aside>
  );
}
