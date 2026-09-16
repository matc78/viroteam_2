"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChatThreadView } from "@/components/chat/ChatThreadView";
import { ConversationListItem } from "@/components/chat/ConversationListItem";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { useChat } from "@/lib/chat/ChatProvider";
import { chatStateDocId } from "@/lib/firebase/chatTypes";
import styles from "./MessagesPageClient.module.css";

type MessagesPageClientProps = {
  eyebrow: string;
  isPanelActive: boolean;
};

/**
 * Page messagerie pleine largeur (liste + thread), keep-alive.
 * Query `?clubId=&conversationId=` sélectionne le thread (deep link notif).
 */
export function MessagesPageClient({
  eyebrow,
  isPanelActive,
}: MessagesPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    conversations,
    chatStates,
    clubNameById,
    clubColorById,
    inboxLoading,
    openCompose,
    roleForClub,
    setDockOpen,
  } = useChat();

  const queryClubId = searchParams.get("clubId");
  const queryConversationId = searchParams.get("conversationId");

  const [selectedClubId, setSelectedClubId] = useState<string | null>(
    queryClubId,
  );
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(queryConversationId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isPanelActive) return;
    setDockOpen(false);
  }, [isPanelActive, setDockOpen]);

  useEffect(() => {
    if (!isPanelActive) return;
    if (queryClubId && queryConversationId) {
      setSelectedClubId(queryClubId);
      setSelectedConversationId(queryConversationId);
    }
  }, [isPanelActive, queryClubId, queryConversationId]);

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
      return (
        title.includes(q) ||
        club.includes(q) ||
        conversation.lastMessagePreview.toLowerCase().includes(q)
      );
    });
  }, [conversations, query, clubNameById]);

  function selectConversation(clubId: string, conversationId: string) {
    setSelectedClubId(clubId);
    setSelectedConversationId(conversationId);
    const params = new URLSearchParams({ clubId, conversationId });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const hasSelection = Boolean(selectedClubId && selectedConversationId);
  const stateId =
    selectedClubId && selectedConversationId
      ? chatStateDocId(selectedClubId, selectedConversationId)
      : null;

  return (
    <div className={styles.pageRoot}>
      <DashboardPageIntro
        eyebrow={eyebrow}
        heading="Messagerie"
        lead="Toutes tes discussions, tous clubs confondus — équipes, parents, coaches."
      >
        <button
          type="button"
          className={styles.composeBtn}
          onClick={openCompose}
        >
          Nouvelle discussion
        </button>
      </DashboardPageIntro>

      <div className={styles.layout}>
        <aside className={styles.listPane}>
          <div className={styles.searchRow}>
            <input
              className={styles.search}
              type="search"
              placeholder="Rechercher dans les messages"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.list}>
            {inboxLoading && conversations.length === 0 ? (
              <p className={styles.empty}>Chargement…</p>
            ) : filtered.length === 0 ? (
              <p className={styles.empty}>Aucune discussion pour l’instant.</p>
            ) : (
              filtered.map((conversation) => {
                const id = chatStateDocId(conversation.clubId, conversation.id);
                const selected =
                  selectedClubId === conversation.clubId &&
                  selectedConversationId === conversation.id;
                return (
                  <ConversationListItem
                    key={id}
                    conversation={conversation}
                    chatState={chatStates[id]}
                    clubName={clubNameById[conversation.clubId]}
                    clubColor={clubColorById[conversation.clubId]}
                    selected={selected}
                    onSelect={() =>
                      selectConversation(conversation.clubId, conversation.id)
                    }
                  />
                );
              })
            )}
          </div>
        </aside>

        <section className={styles.threadPane}>
          {hasSelection && selectedClubId && selectedConversationId ? (
            <ChatThreadView
              clubId={selectedClubId}
              conversationId={selectedConversationId}
              clubRole={roleForClub(selectedClubId)}
              chatState={stateId ? chatStates[stateId] : undefined}
              headerExtra={
                clubNameById[selectedClubId] ? (
                  <span className={styles.clubLabel}>
                    {clubNameById[selectedClubId]}
                  </span>
                ) : null
              }
            />
          ) : (
            <div className={styles.placeholder}>
              <p>Sélectionne une discussion pour commencer.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
