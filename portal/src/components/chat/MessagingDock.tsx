"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type AnimationEvent } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { ConversationListItem } from "@/components/chat/ConversationListItem";
import { InboxListState } from "@/components/chat/InboxListState";
import { useChat } from "@/lib/chat/ChatProvider";
import { filterInbox } from "@/lib/chat/filterInbox";
import { chatStateDocId } from "@/lib/firebase/chatTypes";
import styles from "./MessagingDock.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type DockPhase = "closed" | "open" | "closing";

/** Dock messagerie latéral droit (liste + recherche + composer). */
export function MessagingDock() {
  const {
    dockOpen,
    conversations,
    chatStates,
    clubNameById,
    clubColorById,
    previewSenderByKey,
    inboxLoading,
    inboxError,
    retryInbox,
    messagesHref,
    activeThread,
    setDockOpen,
    setDockExpanded,
    openCompose,
    openCategoryChannel,
    isAdminSomewhere,
    openThread,
    roleForClub,
    isMobileLayout,
    dmPeerNameByKey,
  } = useChat();
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<DockPhase>(dockOpen ? "open" : "closed");

  const filtered = useMemo(
    () =>
      filterInbox({
        conversations,
        chatStates,
        query,
        clubNameById,
        dmPeerNameByKey,
      }),
    [conversations, chatStates, query, clubNameById, dmPeerNameByKey],
  );

  useEffect(() => {
    if (dockOpen) {
      setPhase("open");
      return;
    }
    setPhase((current) => (current === "open" ? "closing" : current));
  }, [dockOpen]);

  const beginClose = () => {
    if (phase !== "open") return;
    setPhase("closing");
  };

  const finishClose = (event?: AnimationEvent<HTMLElement>) => {
    if (phase !== "closing") return;
    if (event && event.target !== event.currentTarget) return;
    setPhase("closed");
    setDockOpen(false);
    setDockExpanded(true);
  };

  const openFromEdge = () => {
    setDockOpen(true);
    setDockExpanded(true);
    setPhase("open");
  };

  if (phase === "closed") {
    return (
      <button
        type="button"
        className={styles.collapsedBar}
        aria-label={chatCopy.openMessaging}
        onClick={openFromEdge}
      >
        <span className={styles.chevron} aria-hidden>
          <ChatIcon name="chevronLeft" size={12} />
        </span>
        <span className={styles.collapsedBarLabel}>{chatCopy.chatEntry}</span>
      </button>
    );
  }

  const dockClassName = [
    styles.dock,
    isMobileLayout ? styles.dockMobile : "",
    phase === "closing" ? styles.dockClosing : styles.dockOpening,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      className={dockClassName}
      aria-label={chatCopy.chatEntry}
      onAnimationEnd={finishClose}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{chatCopy.chatEntry}</h2>
        <div className={styles.headerActions}>
          {isAdminSomewhere ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={chatCopy.createCategoryChannel}
              title={chatCopy.createCategoryChannel}
              onClick={openCategoryChannel}
            >
              <ChatIcon name="plus" size={18} />
            </button>
          ) : null}
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={chatCopy.newConversation}
            onClick={openCompose}
          >
            <ChatIcon name="newMessage" size={18} />
          </button>
          <Link
            href={messagesHref}
            className={styles.iconBtn}
            aria-label={chatCopy.openMessagingPage}
            onClick={beginClose}
          >
            <ChatIcon name="openPage" size={16} />
          </Link>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={chatCopy.collapseDock}
            onClick={beginClose}
          >
            <ChatIcon name="chevronRight" size={16} />
          </button>
          {isMobileLayout ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={chatCopy.close}
              onClick={beginClose}
            >
              <ChatIcon name="close" size={16} />
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.searchRow}>
        <input
          className={styles.search}
          type="search"
          placeholder={chatCopy.searchConversationsHint}
          aria-label={chatCopy.searchConversationsLabel}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className={styles.list}>
        <InboxListState
          loading={inboxLoading}
          error={inboxError}
          onRetry={retryInbox}
          totalCount={conversations.length}
          filteredCount={filtered.length}
          onCompose={openCompose}
        />
        {filtered.map((conversation) => {
            const stateId = chatStateDocId(
              conversation.clubId,
              conversation.id,
            );
            const selected =
              activeThread?.clubId === conversation.clubId &&
              activeThread?.conversationId === conversation.id;
            return (
              <ConversationListItem
                key={stateId}
                conversation={conversation}
                chatState={chatStates[stateId]}
                clubName={clubNameById[conversation.clubId]}
                clubColor={clubColorById[conversation.clubId]}
                clubRole={roleForClub(conversation.clubId)}
                previewSenderByKey={previewSenderByKey}
                peerDisplayName={dmPeerNameByKey[stateId]}
                selected={selected}
                onSelect={() =>
                  openThread({
                    clubId: conversation.clubId,
                    conversationId: conversation.id,
                  })
                }
              />
            );
          })}
      </div>
    </aside>
  );
}
