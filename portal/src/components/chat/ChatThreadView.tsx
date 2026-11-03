"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { ConversationInfoPanel } from "@/components/chat/ConversationInfoPanel";
import { ConversationIntroCard } from "@/components/chat/ConversationIntroCard";
import { CreatePollSheet } from "@/components/chat/CreatePollSheet";
import { PollVotesPanel } from "@/components/chat/PollVotesPanel";
import { Composer } from "@/components/chat/thread/Composer";
import { ImageLightbox } from "@/components/chat/thread/ImageLightbox";
import { MessageActionsPopover } from "@/components/chat/thread/MessageActionsPopover";
import { MessageBubble } from "@/components/chat/thread/MessageBubble";
import { MessageEditDialog } from "@/components/chat/thread/MessageEditDialog";
import { ThreadHeader } from "@/components/chat/thread/ThreadHeader";
import { ThreadSearchBar } from "@/components/chat/thread/ThreadSearchBar";
import { useComposer } from "@/components/chat/thread/useComposer";
import { useMarkReadWhenVisible } from "@/components/chat/thread/useMarkReadWhenVisible";
import { useMessageActions } from "@/components/chat/thread/useMessageActions";
import { useThreadMessages } from "@/components/chat/thread/useThreadMessages";
import { useThreadParticipants } from "@/components/chat/thread/useThreadParticipants";
import { useThreadScroll } from "@/components/chat/thread/useThreadScroll";
import { useThreadSearch } from "@/components/chat/thread/useThreadSearch";
import { formatParticipantPreview } from "@/lib/chat/conversationParticipants";
import { useChatOptional } from "@/lib/chat/ChatProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  canWriteToConversation,
  renameConversation,
  setFavorite,
  setMuted,
  uploadAndSetConversationAvatar,
} from "@/lib/firebase/chatService";
import { ChatMessageTypes, PortalUiRoles } from "@/lib/firebase/constants";
import {
  chatDisplayTitle,
  chatStateDocId,
  canEditGroupAvatar,
  isChatMessageDeleted,
  isGroupConversation,
  readonlyHintFor,
  type ChatUserState,
} from "@/lib/firebase/chatTypes";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import styles from "./ChatThreadView.module.css";

type ChatThreadViewProps = {
  clubId: string;
  conversationId: string;
  clubRole: string | null;
  chatState?: ChatUserState;
  compact?: boolean;
  /** `false` quand la vue reste montée mais masquée (page keep-alive) : pas de `markRead`. */
  isActive?: boolean;
  onClose?: () => void;
  onMaximize?: () => void;
  headerExtra?: ReactNode;
  clubName?: string;
  clubColor?: string | null;
};

/**
 * Vue thread partagée (fenêtre flottante + page messages) :
 * messages, envoi texte/photo/sondage, réactions, infos, mute, favoris, rename.
 * Composition : la logique vit dans les hooks `thread/use*`, le rendu dans
 * les composants `thread/*`.
 */
export function ChatThreadView({
  clubId,
  conversationId,
  clubRole,
  chatState,
  compact = false,
  isActive = true,
  onClose,
  onMaximize,
  headerExtra,
  clubName,
  clubColor,
}: ChatThreadViewProps) {
  const { user, profile } = useAuth();
  const viewerUid = user?.uid;
  const chat = useChatOptional();
  const inboxPeerName =
    chat?.dmPeerNameByKey[chatStateDocId(clubId, conversationId)] ?? null;
  const inboxConversation =
    chat?.conversations.find(
      (entry) => entry.clubId === clubId && entry.id === conversationId,
    ) ?? null;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoRenameOpen, setInfoRenameOpen] = useState(false);
  const [pollVotesMessageId, setPollVotesMessageId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const avatarMenuInputRef = useRef<HTMLInputElement | null>(null);

  const lightboxRef = useDialogA11y({
    onClose: () => setLightboxUrl(null),
    enabled: Boolean(lightboxUrl),
  });

  const thread = useThreadMessages({
    clubId,
    conversationId,
    inboxConversation,
    chatState,
    viewerUid,
  });
  const { conversation, messages } = thread;

  useEffect(() => {
    setLightboxUrl(null);
  }, [clubId, conversationId]);

  useEffect(() => {
    setInfoOpen(false);
    setInfoRenameOpen(false);
    setPollVotesMessageId(null);
    setPollOpen(false);
    setMenuOpen(false);
  }, [clubId, conversationId]);

  const {
    participants,
    allParticipants,
    participantsLoading,
    roleByUid,
    peopleByUid,
    replyAuthorLabel,
  } = useThreadParticipants({
    clubId,
    conversation,
    viewerUid,
    previewSenderByKey: chat?.previewSenderByKey,
    userDisplayNameByUid: chat?.userDisplayNameByUid,
    inboxPeerName,
  });

  const scroll = useThreadScroll({ clubId, conversationId, messages });

  useMarkReadWhenVisible({
    uid: viewerUid,
    clubId,
    conversationId,
    messages,
    isActive,
  });

  const readonlyHint = readonlyHintFor(conversation);
  const canWrite = useMemo(() => {
    if (!conversation || !user) return false;
    return canWriteToConversation({
      conversation,
      uid: user.uid,
      clubRole,
    });
  }, [conversation, user, clubRole]);

  const canPoll =
    canWrite && conversation != null && isGroupConversation(conversation);
  const isGroup = conversation ? isGroupConversation(conversation) : false;
  const canChangeGroupAvatar = conversation
    ? canEditGroupAvatar(conversation)
    : false;
  const muted = chatState?.muted ?? false;
  const favorite = chatState?.favorite ?? false;
  const senderFirstName =
    profile?.firstName?.trim() ||
    profile?.displayName?.trim().split(/\s+/)[0] ||
    "";
  const senderRole = clubRole || PortalUiRoles.parent;
  const title = conversation
    ? chatDisplayTitle(conversation, {
        peerDisplayName:
          (!isGroup && participants.length > 0
            ? participants[0]?.displayName
            : null) || inboxPeerName,
      })
    : "Discussion";
  const titleShort =
    title.length > 25 ? `${title.slice(0, 25).trimEnd()}…` : title;
  const membersPreview = formatParticipantPreview(participants);
  const showMembersPreviewSlot =
    (conversation?.participantUids.length ?? 0) > 0;

  const search = useThreadSearch({
    clubId,
    conversationId,
    messages,
    messageRefs: scroll.messageRefs,
  });

  const composer = useComposer({
    clubId,
    conversationId,
    uid: viewerUid,
    canWrite,
    senderFirstName,
    senderRole,
    setError,
    onSendStart: scroll.forceScrollOnNextMessage,
    onSendFailed: scroll.cancelForcedScroll,
  });

  const actions = useMessageActions({
    clubId,
    conversationId,
    uid: viewerUid,
    messagesRef: scroll.messagesRef,
    messageRefs: scroll.messageRefs,
    setError,
    onReply: composer.setReplyTarget,
  });

  function openInfo(options?: { rename?: boolean }) {
    setMenuOpen(false);
    setPollVotesMessageId(null);
    setPollOpen(false);
    setInfoRenameOpen(Boolean(options?.rename));
    setInfoOpen(true);
  }

  function openPollVotes(messageId: string) {
    setMenuOpen(false);
    setInfoOpen(false);
    setInfoRenameOpen(false);
    setPollOpen(false);
    setPollVotesMessageId(messageId);
  }

  function openCreatePoll() {
    setMenuOpen(false);
    composer.setAttachOpen(false);
    setInfoOpen(false);
    setInfoRenameOpen(false);
    setPollVotesMessageId(null);
    setPollOpen(true);
  }

  function openSearch() {
    setMenuOpen(false);
    setInfoOpen(false);
    search.setSearchOpen(true);
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

  async function handleToggleFavorite() {
    if (!user) return;
    setMenuOpen(false);
    await setFavorite({
      uid: user.uid,
      clubId,
      conversationId,
      favorite: !favorite,
    });
  }

  async function handleRename(nextTitle: string) {
    await renameConversation({
      clubId,
      conversationId,
      titleOverride: nextTitle,
    });
  }

  async function handleChangeAvatar(file: File) {
    if (!user) return;
    const bytes = await file.arrayBuffer();
    const contentType = file.type.startsWith("image/")
      ? file.type
      : "image/jpeg";
    await uploadAndSetConversationAvatar({
      clubId,
      conversationId,
      uid: user.uid,
      bytes,
      contentType,
    });
  }

  function openChangeAvatarFromMenu() {
    setMenuOpen(false);
    avatarMenuInputRef.current?.click();
  }

  async function handleAvatarMenuFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    try {
      await handleChangeAvatar(file);
    } catch {
      setError("Impossible de changer la photo.");
    } finally {
      if (avatarMenuInputRef.current) avatarMenuInputRef.current.value = "";
    }
  }

  const pollVotesMessage = useMemo(() => {
    if (!pollVotesMessageId) return null;
    return (
      messages.find(
        (message) =>
          message.id === pollVotesMessageId &&
          message.type === ChatMessageTypes.poll &&
          !isChatMessageDeleted(message),
      ) ?? null
    );
  }, [messages, pollVotesMessageId]);

  useEffect(() => {
    if (pollVotesMessageId && !pollVotesMessage) {
      setPollVotesMessageId(null);
    }
  }, [pollVotesMessageId, pollVotesMessage]);

  const sidePanelOpen =
    infoOpen || pollOpen || pollVotesMessage != null;
  const { actionMessage } = actions;

  return (
    <div
      className={`${styles.root}${compact ? ` ${styles.rootCompact}` : ""}${sidePanelOpen ? ` ${styles.rootWithInfo}` : ""}`}
      data-info-open={sidePanelOpen ? "true" : undefined}
    >
      <div className={styles.chatColumn}>
      <ThreadHeader
        title={title}
        titleShort={titleShort}
        favorite={favorite}
        muted={muted}
        headerExtra={headerExtra}
        showMembersPreviewSlot={showMembersPreviewSlot}
        membersPreview={membersPreview}
        isGroup={isGroup}
        canChangeGroupAvatar={canChangeGroupAvatar}
        canPoll={canPoll}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onOpenInfo={openInfo}
        onOpenSearch={openSearch}
        onToggleMute={() => void handleToggleMute()}
        onToggleFavorite={() => void handleToggleFavorite()}
        onChangeAvatar={openChangeAvatarFromMenu}
        onCreatePoll={openCreatePoll}
        onMaximize={onMaximize}
        onClose={onClose}
      />

      {search.searchOpen ? (
        <ThreadSearchBar
          query={search.searchQuery}
          matchCount={search.searchMatches.length}
          onQueryChange={search.setSearchQuery}
          onClose={search.closeSearch}
        />
      ) : null}

      <div
        className={`${styles.messages}${composer.dragOver ? ` ${styles.messagesDragOver}` : ""}`}
        ref={scroll.messagesRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Messages"
        onDragOver={composer.handleDragOver}
        onDragLeave={composer.handleDragLeave}
        onDrop={(event) => void composer.handleDrop(event)}
      >
        {isGroup && conversation ? (
          <ConversationIntroCard
            conversation={conversation}
            title={title}
            clubName={clubName}
            clubColor={clubColor}
            participants={participants}
            onOpenInfo={() => openInfo()}
          />
        ) : null}
        {thread.hasMoreOlder ? (
          <button
            type="button"
            className={styles.loadMoreBtn}
            disabled={thread.loadingOlder}
            onClick={() =>
              void thread.loadOlder({
                viewport: scroll.messagesRef.current,
                beforePrepend: scroll.skipNextAutoScroll,
                setError,
              })
            }
          >
            {thread.loadingOlder ? "Chargement…" : "Charger plus"}
          </button>
        ) : null}
        {thread.threadRows.length === 0 ? (
          <p className={styles.emptyHint}>
            Pas encore de messages. Lance-toi.
          </p>
        ) : (
          thread.threadRows.map((row) => {
            if (row.kind === "date") {
              return (
                <div key={row.id} className={styles.dateChip}>
                  {row.label}
                </div>
              );
            }
            if (row.kind === "unread") {
              return (
                <div key={row.id} className={styles.unreadSeparator}>
                  <span className={styles.unreadSeparatorLine} aria-hidden />
                  <span className={styles.unreadSeparatorLabel}>nouveau</span>
                  <span className={styles.unreadSeparatorLine} aria-hidden />
                </div>
              );
            }
            const message = row.message;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                viewerUid={viewerUid}
                isGroup={isGroup}
                isMatch={search.isSearchMatch(message.id)}
                senderRole={roleByUid.get(message.senderUid)}
                peopleByUid={peopleByUid}
                rowRef={(node) => {
                  scroll.messageRefs.current[message.id] = node;
                }}
                replyAuthorLabel={replyAuthorLabel}
                onOpenActions={actions.openMessageActions}
                onBubblePointerDown={actions.onBubblePointerDown}
                onBubblePointerEnd={actions.clearLongPressTimer}
                onQuoteClick={scroll.scrollToMessage}
                onOpenImage={setLightboxUrl}
                onVote={(target, optionId) =>
                  void actions.handleVote(target, optionId)
                }
                onOpenPollVotes={openPollVotes}
                onToggleReaction={(target, emoji) =>
                  void actions.handleReaction(target, emoji)
                }
              />
            );
          })
        )}
        <div ref={scroll.bottomRef} />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {canWrite ? (
        <Composer
          draft={composer.draft}
          onDraftChange={composer.setDraft}
          busy={composer.busy}
          replyTarget={composer.replyTarget}
          onCancelReply={() => composer.setReplyTarget(null)}
          replyAuthorLabel={replyAuthorLabel}
          attachOpen={composer.attachOpen}
          onToggleAttach={() => composer.setAttachOpen((open) => !open)}
          onPickPhoto={() => {
            composer.setAttachOpen(false);
            composer.fileInputRef.current?.click();
          }}
          canPoll={canPoll}
          onCreatePoll={openCreatePoll}
          attachWrapRef={composer.attachWrapRef}
          fileInputRef={composer.fileInputRef}
          onImageChange={(e) => void composer.handleImage(e)}
          avatarMenuInputRef={avatarMenuInputRef}
          onAvatarMenuFileChange={(e) => void handleAvatarMenuFileChange(e)}
          onPaste={composer.handlePaste}
          onSend={(e) => void composer.handleSend(e)}
        />
      ) : readonlyHint ? (
        <p className={styles.readonly}>{readonlyHint}</p>
      ) : null}

      </div>

      {pollOpen ? (
        <CreatePollSheet
          onClose={() => setPollOpen(false)}
          onSubmit={async (payload) => {
            if (!user) return;
            await composer.sendPoll(payload);
            setPollOpen(false);
          }}
        />
      ) : pollVotesMessage ? (
        <PollVotesPanel
          message={pollVotesMessage}
          participants={allParticipants}
          participantCount={
            conversation?.participantUids.length ?? allParticipants.length
          }
          onClose={() => setPollVotesMessageId(null)}
        />
      ) : infoOpen && conversation ? (
        <ConversationInfoPanel
          key={`${conversation.id}-${infoRenameOpen ? "rename" : "info"}`}
          conversation={conversation}
          messages={messages}
          participants={participants}
          participantsLoading={participantsLoading}
          clubName={clubName}
          clubColor={clubColor}
          muted={muted}
          favorite={favorite}
          onClose={() => {
            setInfoOpen(false);
            setInfoRenameOpen(false);
          }}
          onSearch={openSearch}
          onToggleMute={() => void handleToggleMute()}
          onToggleFavorite={() => void handleToggleFavorite()}
          onRename={handleRename}
          onChangeAvatar={handleChangeAvatar}
          initialRenameOpen={infoRenameOpen}
        />
      ) : null}

      {actionMessage ? (
        <MessageActionsPopover
          message={actionMessage}
          layout={actions.actionLayout}
          overlayRef={actions.actionOverlayRef}
          viewerUid={viewerUid}
          canWrite={canWrite}
          onClose={actions.closeActions}
          onReaction={(emoji) => void actions.handleReaction(actionMessage, emoji)}
          onReply={() => actions.startReply(actionMessage)}
          onCopy={() => void actions.handleCopy(actionMessage)}
          onEdit={() => actions.openEdit(actionMessage)}
          onDelete={() => void actions.handleDelete(actionMessage)}
        />
      ) : null}

      {lightboxUrl ? (
        <ImageLightbox
          overlayRef={lightboxRef}
          url={lightboxUrl}
          onClose={() => setLightboxUrl(null)}
        />
      ) : null}

      {actions.editingMessage ? (
        <MessageEditDialog
          overlayRef={actions.editOverlayRef}
          draft={actions.editDraft}
          onDraftChange={actions.setEditDraft}
          onSave={() => void actions.handleEditSave()}
          onClose={actions.closeEdit}
        />
      ) : null}
    </div>
  );
}
