"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import {
  MessageReactionsBar,
  type ReactionPerson,
} from "@/components/chat/MessageReactions";
import { MessageImage } from "@/components/chat/thread/MessageImage";
import { MemberAvatar } from "@/components/dashboard/MemberAvatar";
import { previewSenderRoleTone } from "@/lib/chat/conversationPreview";
import { linkifyMessageText } from "@/lib/chat/linkifyMessageText";
import type { DeliveryStatus } from "@/lib/chat/pendingMessages";
import { messageTimeLabel } from "@/lib/chat/threadMessages";
import { ChatMessageTypes } from "@/lib/firebase/constants";
import {
  hasVotedFor,
  isChatMessageDeleted,
  pollUniqueVoterCount,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";
import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type MessageBubbleProps = {
  message: ChatMessage;
  viewerUid: string | undefined;
  isGroup: boolean;
  /** Résultat de la recherche en cours (surlignage). */
  isMatch: boolean;
  /** Résultat courant de la recherche (surlignage appuyé). */
  isCurrentMatch: boolean;
  /** Regroupé avec le message précédent : pas de nom, écart réduit. */
  groupedWithPrevious: boolean;
  /** Regroupé avec le message suivant : pas d’avatar ni de « queue ». */
  groupedWithNext: boolean;
  /** Envoi optimiste en cours ou en échec (absent = confirmé). */
  delivery?: DeliveryStatus;
  /** Réactions à afficher (surcharge optimiste comprise). */
  reactions: Record<string, string[]>;
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
  /** Relance un envoi en échec. */
  onRetrySend: (messageId: string) => void;
};

/**
 * Ligne message du fil : avatar + nom (groupe, autres membres ; nom sur le
 * premier message d’un groupe, avatar sur le dernier), citation, contenu
 * texte / photo / sondage, horodatage, statut d’envoi et réactions.
 */
export function MessageBubble({
  message,
  viewerUid,
  isGroup,
  isMatch,
  isCurrentMatch,
  groupedWithPrevious,
  groupedWithNext,
  delivery,
  reactions,
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
  onRetrySend,
}: MessageBubbleProps) {
  const mine = viewerUid === message.senderUid;
  const deleted = isChatMessageDeleted(message);
  const roleTone = previewSenderRoleTone(senderRole);
  const showSenderMeta = isGroup && !mine;
  const senderPerson = showSenderMeta
    ? peopleByUid.get(message.senderUid)
    : undefined;
  const senderLabel =
    showSenderMeta && !groupedWithPrevious
      ? senderPerson?.displayName?.trim() ||
        senderPerson?.label ||
        chatCopy.someone
      : null;
  const showAvatar = showSenderMeta && !groupedWithNext;
  const timeLabel = deleted ? "" : messageTimeLabel(message);
  const timeIso = deleted ? undefined : message.createdAt.toISOString();
  const hasReply =
    !deleted && Boolean(message.replyToMessageId && message.replyToText);
  const hasReactions =
    !deleted && Object.values(reactions).some((uids) => uids.length > 0);
  const pending = delivery != null;

  const rowClassName = [
    styles.bubbleRow,
    mine ? styles.bubbleRowMine : "",
    showSenderMeta ? styles.bubbleRowWithAvatar : "",
    groupedWithPrevious ? styles.bubbleRowGrouped : "",
    isMatch ? styles.bubbleRowMatch : "",
    isCurrentMatch ? styles.bubbleRowCurrentMatch : "",
    delivery === "sending" ? styles.bubbleRowSending : "",
  ]
    .filter(Boolean)
    .join(" ");

  const bubbleClassName = [
    styles.bubble,
    mine ? styles.bubbleMine : "",
    groupedWithNext ? styles.bubbleNoTail : "",
    delivery === "failed" ? styles.bubbleFailed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rowRef} className={rowClassName}>
      {showSenderMeta ? (
        <span
          className={`${styles.senderAvatar}${
            hasReactions ? ` ${styles.senderAvatarWithReactions}` : ""
          }`}
          aria-hidden={showAvatar ? undefined : true}
        >
          {showAvatar ? (
            <MemberAvatar
              displayName={
                senderPerson?.displayName ||
                senderPerson?.label ||
                chatCopy.unknownMember
              }
              avatarUrl={senderPerson?.avatarUrl}
              hasLinkedAccount={senderPerson?.hasLinkedAccount ?? false}
              diameter="var(--chat-avatar-sender)"
              enableZoom={false}
            />
          ) : null}
        </span>
      ) : null}
      <div
        className={`${styles.bubbleShell}${
          hasReactions ? ` ${styles.bubbleShellWithReactions}` : ""
        }`}
      >
        <div
          className={bubbleClassName}
          data-msg-bubble=""
          data-role={roleTone}
          onContextMenu={(event) => {
            event.preventDefault();
            if (!pending) onOpenActions(message);
          }}
          onPointerDown={(event) => {
            if (!pending) onBubblePointerDown(event, message);
          }}
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
            <p className={styles.deleted}>{chatCopy.messageDeleted}</p>
          ) : message.type === ChatMessageTypes.image ? (
            <MessageImage
              message={message}
              timeLabel={timeLabel}
              timeIso={timeIso}
              onOpenImage={onOpenImage}
            />
          ) : message.type === ChatMessageTypes.poll ? (
            <div className={styles.poll}>
              <p className={styles.pollQuestion}>
                {message.pollQuestion || message.text}
              </p>
              <p className={styles.pollMode}>
                {message.pollAllowMultiple
                  ? chatCopy.pollAllowMultiple
                  : chatCopy.pollSingleChoice}
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
                  {chatCopy.pollVotersLabel(pollUniqueVoterCount(message))}
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
                {chatCopy.viewVotes}
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
        {delivery === "sending" ? (
          <p className={styles.deliveryStatus}>
            {chatCopy.messageSending}
          </p>
        ) : delivery === "failed" ? (
          <button
            type="button"
            className={styles.deliveryRetry}
            aria-label={chatCopy.retrySendLabel}
            onClick={() => onRetrySend(message.id)}
          >
            <ChatIcon name="closeCircle" size={14} />
            {chatCopy.messageSendFailed} · {chatCopy.retrySend}
          </button>
        ) : null}
        {!deleted && !pending ? (
          <MessageReactionsBar
            reactions={reactions}
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
