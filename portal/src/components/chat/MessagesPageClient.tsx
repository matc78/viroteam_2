"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChatThreadView } from "@/components/chat/ChatThreadView";
import { ClubBadge } from "@/components/chat/ClubBadge";
import { InboxListState } from "@/components/chat/InboxListState";
import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { ConversationListItem } from "@/components/chat/ConversationListItem";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { useChat } from "@/lib/chat/ChatProvider";
import { filterInbox } from "@/lib/chat/filterInbox";
import { chatStateDocId } from "@/lib/firebase/chatTypes";
import styles from "./MessagesPageClient.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

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
    previewSenderByKey,
    inboxLoading,
    inboxError,
    retryInbox,
    openCompose,
    openCategoryChannel,
    isAdminSomewhere,
    roleForClub,
    setDockOpen,
    dmPeerNameByKey,
  } = useChat();

  useReportPageReady(
    isPanelActive && !(inboxLoading && conversations.length === 0),
    isPanelActive ? pathname : null,
  );

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
        heading={chatCopy.chatEntry}
        lead={chatCopy.pageLead}
      >
        <div className={styles.headerActions}>
          {isAdminSomewhere ? (
            <button
              type="button"
              className={styles.categoryBtn}
              onClick={openCategoryChannel}
            >
              {chatCopy.createCategoryChannel}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.composeBtn}
            onClick={openCompose}
          >
            {chatCopy.newConversation}
          </button>
        </div>
      </DashboardPageIntro>

      <div className={styles.layout}>
        <aside className={styles.listPane}>
          <div className={styles.searchRow}>
            <input
              className={styles.search}
              type="search"
              placeholder={chatCopy.searchConversationsHint}
              aria-label={chatCopy.searchConversationsLabel}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.list}>
            <InboxListState
              loading={inboxLoading}
              error={inboxError}
              onRetry={retryInbox}
              totalCount={conversations.length}
              filteredCount={filtered.length}
            />
            {filtered.map((conversation) => {
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
                    clubRole={roleForClub(conversation.clubId)}
                    previewSenderByKey={previewSenderByKey}
                    peerDisplayName={dmPeerNameByKey[id]}
                    selected={selected}
                    onSelect={() =>
                      selectConversation(conversation.clubId, conversation.id)
                    }
                  />
                );
              })}
          </div>
        </aside>

        <section className={styles.threadPane}>
          {hasSelection && selectedClubId && selectedConversationId ? (
            <ChatThreadView
              key={`${selectedClubId}-${selectedConversationId}`}
              clubId={selectedClubId}
              conversationId={selectedConversationId}
              isActive={isPanelActive}
              clubRole={roleForClub(selectedClubId)}
              chatState={stateId ? chatStates[stateId] : undefined}
              clubName={clubNameById[selectedClubId]}
              clubColor={clubColorById[selectedClubId]}
              headerExtra={
                clubNameById[selectedClubId] ? (
                  <ClubBadge
                    name={clubNameById[selectedClubId]}
                    color={clubColorById[selectedClubId]}
                  />
                ) : null
              }
            />
          ) : (
            <div className={styles.placeholder}>
              <p>{chatCopy.selectConversationHint}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
