"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ConversationListItem } from "@/components/chat/ConversationListItem";
import { useChat } from "@/lib/chat/ChatProvider";
import { chatStateDocId } from "@/lib/firebase/chatTypes";
import styles from "./MessagingDock.module.css";

/** Dock messagerie bas-droite (liste + recherche + composer). */
export function MessagingDock() {
  const {
    dockOpen,
    dockExpanded,
    conversations,
    chatStates,
    clubNameById,
    clubColorById,
    inboxLoading,
    messagesHref,
    activeThread,
    setDockOpen,
    setDockExpanded,
    openCompose,
    openThread,
    isMobileLayout,
  } = useChat();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conversation) => {
      const title = (
        conversation.titleOverride ||
        conversation.title ||
        ""
      ).toLowerCase();
      const club = (clubNameById[conversation.clubId] ?? "").toLowerCase();
      const preview = conversation.lastMessagePreview.toLowerCase();
      return title.includes(q) || club.includes(q) || preview.includes(q);
    });
  }, [conversations, query, clubNameById]);

  if (!dockOpen) {
    return (
      <button
        type="button"
        className={styles.collapsedBar}
        onClick={() => {
          setDockOpen(true);
          setDockExpanded(true);
        }}
      >
        <span>Messagerie</span>
        <span className={styles.chevron} aria-hidden>
          ▲
        </span>
      </button>
    );
  }

  return (
    <aside
      className={`${styles.dock}${isMobileLayout ? ` ${styles.dockMobile}` : ""}`}
      aria-label="Messagerie"
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Messagerie</h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Nouvelle discussion"
            onClick={openCompose}
          >
            ✎
          </button>
          <Link
            href={messagesHref}
            className={styles.iconBtn}
            aria-label="Ouvrir la messagerie en page"
            onClick={() => setDockOpen(false)}
          >
            ↗
          </Link>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={dockExpanded ? "Réduire" : "Agrandir"}
            onClick={() => setDockExpanded(!dockExpanded)}
          >
            {dockExpanded ? "▼" : "▲"}
          </button>
          {isMobileLayout ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Fermer"
              onClick={() => setDockOpen(false)}
            >
              ×
            </button>
          ) : null}
        </div>
      </header>

      {dockExpanded ? (
        <>
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
                  Les chats d’équipe et parents apparaissent dès que ton club
                  est prêt.
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
        </>
      ) : null}
    </aside>
  );
}
