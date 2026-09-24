"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type AnimationEvent } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { ConversationListItem } from "@/components/chat/ConversationListItem";
import { useChat } from "@/lib/chat/ChatProvider";
import { sortInboxConversations } from "@/lib/firebase/chatService";
import { chatStateDocId } from "@/lib/firebase/chatTypes";
import styles from "./MessagingDock.module.css";

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

  const filtered = useMemo(() => {
    const sorted = sortInboxConversations(conversations, chatStates);
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((conversation) => {
      const stateId = chatStateDocId(conversation.clubId, conversation.id);
      const title = (
        conversation.titleOverride ||
        dmPeerNameByKey[stateId] ||
        conversation.title ||
        ""
      ).toLowerCase();
      const club = (clubNameById[conversation.clubId] ?? "").toLowerCase();
      const preview = conversation.lastMessagePreview.toLowerCase();
      return title.includes(q) || club.includes(q) || preview.includes(q);
    });
  }, [conversations, chatStates, query, clubNameById, dmPeerNameByKey]);

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
        onClick={openFromEdge}
      >
        <span className={styles.chevron} aria-hidden>
          <ChatIcon name="chevronLeft" size={12} />
        </span>
        <span className={styles.collapsedBarLabel}>Messagerie</span>
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
      aria-label="Messagerie"
      onAnimationEnd={finishClose}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Messagerie</h2>
        <div className={styles.headerActions}>
          {isAdminSomewhere ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Canal catégorie"
              title="Canal catégorie"
              onClick={openCategoryChannel}
            >
              <ChatIcon name="plus" size={18} />
            </button>
          ) : null}
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Nouvelle discussion"
            onClick={openCompose}
          >
            <ChatIcon name="newMessage" size={18} />
          </button>
          <Link
            href={messagesHref}
            className={styles.iconBtn}
            aria-label="Ouvrir la messagerie en page"
            onClick={beginClose}
          >
            <ChatIcon name="openPage" size={16} />
          </Link>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Réduire"
            onClick={beginClose}
          >
            <ChatIcon name="chevronRight" size={16} />
          </button>
          {isMobileLayout ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Fermer"
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
          placeholder="Rechercher dans les messages"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className={styles.list}>
        {inboxLoading && conversations.length === 0 ? (
          <p className={styles.empty}>Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyBlock}>
            <p className={styles.empty}>Aucune discussion pour l’instant.</p>
            <p className={styles.emptyHint}>
              Les chats d’équipe et parents apparaissent dès que ton club est
              prêt.
            </p>
            <button
              type="button"
              className={styles.composeCta}
              onClick={openCompose}
            >
              Nouvelle discussion
            </button>
          </div>
        ) : (
          filtered.map((conversation) => {
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
          })
        )}
      </div>
    </aside>
  );
}
