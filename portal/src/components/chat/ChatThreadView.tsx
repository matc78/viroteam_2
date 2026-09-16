"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  canWriteToConversation,
  markRead,
  renameConversation,
  sendImageMessage,
  sendPollMessage,
  sendTextMessage,
  setMuted,
  softDeleteMessage,
  toggleReaction,
  votePollOption,
  watchConversation,
  watchMessages,
} from "@/lib/firebase/chatService";
import {
  ChatMessageTypes,
  chatDisplayTitle,
  hasVotedFor,
  isChatMessageDeleted,
  pollUniqueVoterCount,
  type ChatConversation,
  type ChatMessage,
  type ChatUserState,
} from "@/lib/firebase/chatTypes";
import { CreatePollSheet } from "@/components/chat/CreatePollSheet";
import styles from "./ChatThreadView.module.css";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

type ChatThreadViewProps = {
  clubId: string;
  conversationId: string;
  clubRole: string | null;
  chatState?: ChatUserState;
  compact?: boolean;
  onClose?: () => void;
  onMaximize?: () => void;
  headerExtra?: ReactNode;
};

/**
 * Vue thread partagée (fenêtre flottante + page messages) :
 * messages, envoi texte/photo/sondage, réactions, mute, rename.
 */
export function ChatThreadView({
  clubId,
  conversationId,
  clubRole,
  chatState,
  compact = false,
  onClose,
  onMaximize,
  headerExtra,
}: ChatThreadViewProps) {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastMarkedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubConv = watchConversation({
      clubId,
      conversationId,
      onData: setConversation,
    });
    const unsubMsgs = watchMessages({
      clubId,
      conversationId,
      onData: setMessages,
    });
    return () => {
      unsubConv();
      unsubMsgs();
    };
  }, [clubId, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!user || messages.length === 0) return;
    const lastId = messages[messages.length - 1]!.id;
    if (lastMarkedIdRef.current === lastId) return;
    lastMarkedIdRef.current = lastId;
    void markRead({ uid: user.uid, clubId, conversationId });
  }, [messages, user, clubId, conversationId]);

  const canWrite = useMemo(() => {
    if (!conversation || !user) return false;
    return canWriteToConversation({
      conversation,
      uid: user.uid,
      clubRole,
    });
  }, [conversation, user, clubRole]);

  const canPoll =
    canWrite && (conversation?.participantUids.length ?? 0) > 2;
  const muted = chatState?.muted ?? false;
  const title = conversation
    ? chatDisplayTitle(conversation)
    : "Discussion";

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!user || !canWrite || busy) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await sendTextMessage({
        clubId,
        conversationId,
        senderUid: user.uid,
        text,
      });
      setDraft("");
    } catch {
      setError("Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || !canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      await sendImageMessage({
        clubId,
        conversationId,
        senderUid: user.uid,
        bytes,
        contentType: file.type || "image/jpeg",
      });
    } catch {
      setError("Envoi de la photo impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleMute() {
    if (!user) return;
    setMenuOpen(false);
    await setMuted({
      uid: user.uid,
      clubId,
      conversationId,
      muted: !muted,
    });
  }

  async function handleRename() {
    if (!conversation) return;
    setMenuOpen(false);
    const next = window.prompt(
      "Nouveau nom",
      chatDisplayTitle(conversation),
    );
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    await renameConversation({
      clubId,
      conversationId,
      titleOverride: trimmed,
    });
  }

  async function handleDelete(message: ChatMessage) {
    if (!user) return;
    if (!window.confirm("Supprimer ce message ?")) return;
    await softDeleteMessage({
      clubId,
      conversationId,
      messageId: message.id,
      deletedByUid: user.uid,
    });
  }

  async function handleReaction(message: ChatMessage, emoji: string) {
    if (!user || isChatMessageDeleted(message)) return;
    await toggleReaction({
      clubId,
      conversationId,
      messageId: message.id,
      emoji,
      uid: user.uid,
    });
  }

  async function handleVote(message: ChatMessage, optionId: string) {
    if (!user || isChatMessageDeleted(message)) return;
    try {
      await votePollOption({
        clubId,
        conversationId,
        messageId: message.id,
        optionId,
        uid: user.uid,
      });
    } catch {
      setError("Vote impossible.");
    }
  }

  return (
    <div className={`${styles.root}${compact ? ` ${styles.rootCompact}` : ""}`}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h3 className={styles.title}>{title}</h3>
          {headerExtra}
        </div>
        <div className={styles.headerActions}>
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Options"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div className={styles.menu}>
                <button type="button" onClick={() => void handleToggleMute()}>
                  {muted ? "Réactiver les notifs" : "Couper les notifs"}
                </button>
                <button type="button" onClick={() => void handleRename()}>
                  Renommer
                </button>
                {canPoll ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setPollOpen(true);
                    }}
                  >
                    Sondage
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {onMaximize ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Agrandir"
              onClick={onMaximize}
            >
              ↗
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Fermer"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.messages}>
        {messages.length === 0 ? (
          <p className={styles.emptyHint}>Pas encore de messages. Lance-toi.</p>
        ) : (
          messages.map((message) => {
            const mine = user?.uid === message.senderUid;
            const deleted = isChatMessageDeleted(message);
            return (
              <div
                key={message.id}
                className={`${styles.bubbleRow}${mine ? ` ${styles.bubbleRowMine}` : ""}`}
              >
                <div
                  className={`${styles.bubble}${mine ? ` ${styles.bubbleMine}` : ""}`}
                >
                  {deleted ? (
                    <p className={styles.deleted}>Message supprimé</p>
                  ) : message.type === ChatMessageTypes.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={message.thumbUrl || message.downloadUrl || ""}
                      alt="Photo"
                      className={styles.image}
                    />
                  ) : message.type === ChatMessageTypes.poll ? (
                    <div className={styles.poll}>
                      <p className={styles.pollQuestion}>
                        {message.pollQuestion || message.text}
                      </p>
                      <ul className={styles.pollOptions}>
                        {message.pollOptions.map((option) => {
                          const selected =
                            user != null &&
                            hasVotedFor(message, user.uid, option.id);
                          const count =
                            message.pollVotes[option.id]?.length ?? 0;
                          return (
                            <li key={option.id}>
                              <button
                                type="button"
                                className={`${styles.pollOption}${selected ? ` ${styles.pollOptionSelected}` : ""}`}
                                onClick={() =>
                                  void handleVote(message, option.id)
                                }
                              >
                                <span>{option.text}</span>
                                <span className={styles.pollCount}>{count}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <p className={styles.pollMeta}>
                        {pollUniqueVoterCount(message) <= 1
                          ? `${pollUniqueVoterCount(message)} vote`
                          : `${pollUniqueVoterCount(message)} votes`}
                      </p>
                    </div>
                  ) : (
                    <p className={styles.text}>{message.text}</p>
                  )}

                  {!deleted ? (
                    <div className={styles.reactions}>
                      {Object.entries(message.reactions).map(
                        ([emoji, uids]) =>
                          uids.length > 0 ? (
                            <button
                              key={emoji}
                              type="button"
                              className={styles.reactionChip}
                              onClick={() => void handleReaction(message, emoji)}
                            >
                              {emoji} {uids.length}
                            </button>
                          ) : null,
                      )}
                      <details className={styles.reactMenu}>
                        <summary aria-label="Réagir">＋</summary>
                        <div className={styles.reactChoices}>
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() =>
                                void handleReaction(message, emoji)
                              }
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </details>
                      {mine ? (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => void handleDelete(message)}
                        >
                          Supprimer
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {canWrite ? (
        <form className={styles.composer} onSubmit={(e) => void handleSend(e)}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void handleImage(e)}
          />
          <button
            type="button"
            className={styles.attachBtn}
            aria-label="Ajouter une photo"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            🖼
          </button>
          {canPoll ? (
            <button
              type="button"
              className={styles.attachBtn}
              aria-label="Créer un sondage"
              disabled={busy}
              onClick={() => setPollOpen(true)}
            >
              📊
            </button>
          ) : null}
          <input
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Écrire un message…"
            disabled={busy}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={busy || !draft.trim()}
          >
            Envoyer
          </button>
        </form>
      ) : (
        <p className={styles.readonly}>
          Seuls les admins peuvent écrire ici.
        </p>
      )}

      {pollOpen ? (
        <CreatePollSheet
          onClose={() => setPollOpen(false)}
          onSubmit={async (payload) => {
            if (!user) return;
            await sendPollMessage({
              clubId,
              conversationId,
              senderUid: user.uid,
              question: payload.question,
              optionTexts: payload.options,
              allowMultiple: payload.allowMultiple,
            });
            setPollOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
