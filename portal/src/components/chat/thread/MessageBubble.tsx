"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import {
  MessageReactionsBar,
  type ReactionPerson,
} from "@/components/chat/MessageReactions";
import { MemberAvatar } from "@/components/dashboard/MemberAvatar";
import { previewSenderRoleTone } from "@/lib/chat/conversationPreview";
import { linkifyMessageText } from "@/lib/chat/linkifyMessageText";
import { messageTimeLabel } from "@/lib/chat/threadMessages";
import { ChatMessageTypes } from "@/lib/firebase/constants";
import {
  hasVotedFor,
  isChatMessageDeleted,
  pollUniqueVoterCount,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";
import styles from "../ChatThreadView.module.css";

type MessageBubbleProps = {
  message: ChatMessage;
  viewerUid: string | undefined;
  isGroup: boolean;
  /** Résultat de la recherche en cours (surlignage). */
  isMatch: boolean;
  senderRole: string | undefined;
  peopleByUid: Map<string, ReactionPerson>;
  rowRef: (node: HTMLDivElement | null) => void;
  replyAuthorLabel: (senderUid: string | null | undefined) => string;
  onOpenActions: (message: ChatMessage) => void;
  onBubblePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    message: ChatMessage,
  ) => void;
  onBubblePointerEnd: () => void;
  onQuoteClick: (messageId: string) => void;
  onOpenImage: (url: string) => void;
  onVote: (message: ChatMessage, optionId: string) => void;
  onOpenPollVotes: (messageId: string) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
};

/**
 * Ligne message du fil : avatar + nom (groupe, autres membres), citation,
 * contenu texte / photo / sondage, horodatage et réactions.
 */
export function MessageBubble({
  message,
  viewerUid,
  isGroup,
  isMatch,
  senderRole,
  peopleByUid,
  rowRef,
  replyAuthorLabel,
  onOpenActions,
  onBubblePointerDown,
  onBubblePointerEnd,
  onQuoteClick,
  onOpenImage,
  onVote,
  onOpenPollVotes,
  onToggleReaction,
}: MessageBubbleProps) {
  const mine = viewerUid === message.senderUid;
  const deleted = isChatMessageDeleted(message);
  const roleTone = previewSenderRoleTone(senderRole);
  const showSenderMeta = isGroup && !mine;
  const senderPerson = showSenderMeta
    ? peopleByUid.get(message.senderUid)
    : undefined;
  const senderLabel = showSenderMeta
    ? senderPerson?.displayName?.trim() || senderPerson?.label || "Quelqu’un"
    : null;
  const timeLabel = deleted ? "" : messageTimeLabel(message);
  const timeIso = deleted ? undefined : message.createdAt.toISOString();
  const hasReply =
    !deleted && Boolean(message.replyToMessageId && message.replyToText);
  const hasReactions =
    !deleted &&
    Object.values(message.reactions).some((uids) => uids.length > 0);

  return (
    <div
      ref={rowRef}
      className={`${styles.bubbleRow}${mine ? ` ${styles.bubbleRowMine}` : ""}${showSenderMeta ? ` ${styles.bubbleRowWithAvatar}` : ""}${isMatch ? ` ${styles.bubbleRowMatch}` : ""}`}
    >
      {showSenderMeta ? (
        <span
          className={`${styles.senderAvatar}${
            hasReactions ? ` ${styles.senderAvatarWithReactions}` : ""
          }`}
        >
          <MemberAvatar
            displayName={
              senderPerson?.displayName || senderPerson?.label || "Membre"
            }
            avatarUrl={senderPerson?.avatarUrl}
            hasLinkedAccount={senderPerson?.hasLinkedAccount ?? false}
            size="xs"
            enableZoom={false}
          />
        </span>
      ) : null}
      <div
        className={`${styles.bubbleShell}${
          hasReactions ? ` ${styles.bubbleShellWithReactions}` : ""
        }`}
      >
        <div
          className={`${styles.bubble}${mine ? ` ${styles.bubbleMine}` : ""}`}
          data-msg-bubble=""
          data-role={roleTone}
          onContextMenu={(event) => {
            event.preventDefault();
            onOpenActions(message);
          }}
          onPointerDown={(event) => onBubblePointerDown(event, message)}
          onPointerUp={onBubblePointerEnd}
          onPointerLeave={onBubblePointerEnd}
          onPointerCancel={onBubblePointerEnd}
        >
          {senderLabel ? (
            <p className={styles.senderName}>{senderLabel}</p>
          ) : null}
          {hasReply ? (
            <button
              type="button"
              className={styles.quoteBlock}
              onClick={(event) => {
                event.stopPropagation();
                if (message.replyToMessageId) {
                  onQuoteClick(message.replyToMessageId);
                }
              }}
            >
              <span className={styles.quoteAuthor}>
                {replyAuthorLabel(message.replyToSenderUid)}
              </span>
              <span className={styles.quoteText}>{message.replyToText}</span>
            </button>
          ) : null}
          {deleted ? (
            <p className={styles.deleted}>Message supprimé</p>
          ) : message.type === ChatMessageTypes.image ? (
            <div className={styles.imageWrap}>
              <button
                type="button"
                className={styles.imageBtn}
                aria-label="Agrandir la photo"
                onClick={(event) => {
                  event.stopPropagation();
                  const fullUrl = message.downloadUrl || message.thumbUrl || "";
                  if (fullUrl) onOpenImage(fullUrl);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.thumbUrl || message.downloadUrl || ""}
                  alt="Photo"
                  className={styles.image}
                  style={
                    message.width && message.height
                      ? {
                          aspectRatio: `${message.width} / ${message.height}`,
                        }
                      : undefined
                  }
                />
              </button>
              <time className={styles.timeOnImage} dateTime={timeIso}>
                {timeLabel}
              </time>
            </div>
          ) : message.type === ChatMessageTypes.poll ? (
            <div className={styles.poll}>
              <p className={styles.pollQuestion}>
                {message.pollQuestion || message.text}
              </p>
              <p className={styles.pollMode}>
                {message.pollAllowMultiple
                  ? "Plusieurs réponses possibles"
                  : "Réponse unique"}
              </p>
              <ul className={styles.pollOptions}>
                {message.pollOptions.map((option) => {
                  const selected =
                    viewerUid != null &&
                    hasVotedFor(message, viewerUid, option.id);
                  const count = message.pollVotes[option.id]?.length ?? 0;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        className={`${styles.pollOption}${selected ? ` ${styles.pollOptionSelected}` : ""}`}
                        onClick={() => onVote(message, option.id)}
                      >
                        <span
                          className={`${styles.pollMarker}${message.pollAllowMultiple ? ` ${styles.pollMarkerMulti}` : ""}${selected ? ` ${styles.pollMarkerSelected}` : ""}`}
                          aria-hidden
                        />
                        <span className={styles.pollOptionText}>
                          {option.text}
                        </span>
                        <span className={styles.pollCount}>{count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className={styles.pollMetaRow}>
                <p className={styles.pollMeta}>
                  {pollUniqueVoterCount(message) <= 1
                    ? `${pollUniqueVoterCount(message)} vote`
                    : `${pollUniqueVoterCount(message)} votes`}
                </p>
                <time className={styles.time} dateTime={timeIso}>
                  {timeLabel}
                </time>
              </div>
              <button
                type="button"
                className={styles.pollViewVotes}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenPollVotes(message.id);
                }}
              >
                Voir les votes
              </button>
            </div>
          ) : (
            <div className={styles.textWithTime}>
              <p className={styles.text}>
                {message.text ? linkifyMessageText(message.text) : null}
                <span className={styles.timeSpacer} aria-hidden>
                  {timeLabel}
                </span>
              </p>
              <time className={styles.time} dateTime={timeIso}>
                {timeLabel}
              </time>
            </div>
          )}
        </div>
        {!deleted ? (
          <MessageReactionsBar
            reactions={message.reactions}
            myUid={viewerUid}
            peopleByUid={peopleByUid}
            mine={mine}
            onToggle={(emoji) => onToggleReaction(message, emoji)}
          />
        ) : null}
      </div>
    </div>
  );
}
