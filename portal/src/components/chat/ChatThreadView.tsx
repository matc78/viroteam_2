"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  computeAnchoredPopover,
  findScrollParent,
  type AnchoredPopoverLayout,
} from "@/components/chat/anchoredPopover";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { ConversationInfoPanel } from "@/components/chat/ConversationInfoPanel";
import { ConversationIntroCard } from "@/components/chat/ConversationIntroCard";
import { CreatePollSheet } from "@/components/chat/CreatePollSheet";
import { PollVotesPanel } from "@/components/chat/PollVotesPanel";
import {
  MessageReactionsBar,
  ReactionQuickBar,
  type ReactionPerson,
} from "@/components/chat/MessageReactions";
import { MemberAvatar } from "@/components/dashboard/MemberAvatar";
import {
  formatParticipantPreview,
  participantFirstName,
  resolveConversationParticipants,
  seedParticipantsFromPreviewCache,
  type ConversationParticipant,
} from "@/lib/chat/conversationParticipants";
import { effectiveUnreadCount } from "@/lib/chat/conversationUnread";
import {
  formatChatDateSeparator,
  isSameCalendarDay,
} from "@/lib/chat/formatChatDateSeparator";
import { formatChatMessageTime } from "@/lib/chat/formatChatMessageTime";
import { linkifyMessageText } from "@/lib/chat/linkifyMessageText";
import { useChatOptional } from "@/lib/chat/ChatProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  canWriteToConversation,
  editTextMessage,
  fetchOlderMessages,
  markRead,
  renameConversation,
  sendImageMessage,
  sendPollMessage,
  sendTextMessage,
  setFavorite,
  setMuted,
  softDeleteMessage,
  toggleReaction,
  votePollOption,
  watchConversation,
  watchMessages,
} from "@/lib/firebase/chatService";
import {
  ChatMessageTypes,
  MemberRoles,
  PortalUiRoles,
} from "@/lib/firebase/constants";
import {
  chatDisplayTitle,
  chatStateDocId,
  hasVotedFor,
  isChatMessageDeleted,
  isGroupConversation,
  pollUniqueVoterCount,
  type ChatConversation,
  type ChatMessage,
  type ChatUserState,
} from "@/lib/firebase/chatTypes";
import styles from "./ChatThreadView.module.css";

const LONG_PRESS_MS = 450;
const REALTIME_MESSAGE_LIMIT = 100;
const OLDER_PAGE_SIZE = 50;
const NEAR_BOTTOM_PX = 100;

type ThreadRow =
  | { kind: "date"; id: string; label: string }
  | { kind: "unread"; id: string }
  | { kind: "message"; id: string; message: ChatMessage };

/** Texte court pour la citation d’un message. */
function replyPreviewText(message: ChatMessage): string {
  if (message.type === ChatMessageTypes.poll) {
    return message.pollQuestion || message.text || "Sondage";
  }
  if (message.type === ChatMessageTypes.image) return "Photo";
  return (message.text ?? "").trim();
}

function senderRoleTone(role: string | undefined): string {
  if (role === MemberRoles.admin) return MemberRoles.admin;
  if (role === MemberRoles.coach) return MemberRoles.coach;
  if (role === PortalUiRoles.parent) return PortalUiRoles.parent;
  return MemberRoles.player;
}

/** Libellé horodatage (+ « modifié » si besoin). */
function messageTimeLabel(message: ChatMessage): string {
  const time = formatChatMessageTime(message.createdAt);
  return message.editedAt ? `modifié ${time}` : time;
}

type ChatThreadViewProps = {
  clubId: string;
  conversationId: string;
  clubRole: string | null;
  chatState?: ChatUserState;
  compact?: boolean;
  onClose?: () => void;
  onMaximize?: () => void;
  headerExtra?: ReactNode;
  clubName?: string;
  clubColor?: string | null;
};

/**
 * Vue thread partagée (fenêtre flottante + page messages) :
 * messages, envoi texte/photo/sondage, réactions, infos, mute, favoris, rename.
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
  clubName,
  clubColor,
}: ChatThreadViewProps) {
  const { user, profile } = useAuth();
  const chat = useChatOptional();
  const inboxPeerName =
    chat?.dmPeerNameByKey[chatStateDocId(clubId, conversationId)] ?? null;
  const inboxConversation =
    chat?.conversations.find(
      (entry) => entry.clubId === clubId && entry.id === conversationId,
    ) ?? null;
  const [conversationLive, setConversationLive] =
    useState<ChatConversation | null>(null);
  const conversation = conversationLive ?? inboxConversation;
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [participants, setParticipants] = useState<ConversationParticipant[]>(
    [],
  );
  const [allParticipants, setAllParticipants] = useState<
    ConversationParticipant[]
  >([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoRenameOpen, setInfoRenameOpen] = useState(false);
  const [pollVotesMessageId, setPollVotesMessageId] = useState<string | null>(
    null,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [actionLayout, setActionLayout] = useState<AnchoredPopoverLayout | null>(
    null,
  );
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );
  const [editDraft, setEditDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const attachWrapRef = useRef<HTMLDivElement | null>(null);
  const lastMarkedIdRef = useRef<string | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const longPressTimerRef = useRef<number | null>(null);
  const skipAutoScrollRef = useRef(false);
  const lastAutoScrolledKeyRef = useRef<string | null>(null);
  /** Ancre séparateur « nouveau » figée à l’open (avant markRead). */
  const unreadSeparatorAnchorRef = useRef<
    | { kind: "count"; count: number }
    | { kind: "after"; afterMs: number }
    | null
  >(null);
  const unreadSnapshotKeyRef = useRef<string | null>(null);
  const nearBottomRef = useRef(true);
  const forceScrollAfterSendRef = useRef(false);

  const threadKey = `${clubId}:${conversationId}`;
  if (unreadSnapshotKeyRef.current !== threadKey) {
    unreadSnapshotKeyRef.current = threadKey;
    const snapshotConversation = conversation;
    const effective = snapshotConversation
      ? effectiveUnreadCount({
          conversation: snapshotConversation,
          chatState,
          viewerUid: user?.uid,
        })
      : chatState && !chatState.muted
        ? chatState.unreadCount
        : 0;

    if (effective <= 0) {
      unreadSeparatorAnchorRef.current = null;
    } else if (chatState && chatState.unreadCount > 0) {
      unreadSeparatorAnchorRef.current = {
        kind: "count",
        count: chatState.unreadCount,
      };
    } else if (chatState?.lastReadAt) {
      unreadSeparatorAnchorRef.current = {
        kind: "after",
        afterMs: chatState.lastReadAt.getTime(),
      };
    } else {
      unreadSeparatorAnchorRef.current = {
        kind: "count",
        count: effective,
      };
    }
  }

  useEffect(() => {
    setOlderMessages([]);
    setRealtimeMessages([]);
    setHasMoreOlder(false);
    setLoadingOlder(false);
    setReplyTarget(null);
    setLightboxUrl(null);
    setDragOver(false);
    lastMarkedIdRef.current = null;
    skipAutoScrollRef.current = false;
    nearBottomRef.current = true;
    forceScrollAfterSendRef.current = false;
    lastAutoScrolledKeyRef.current = null;
  }, [clubId, conversationId]);

  useEffect(() => {
    setInfoOpen(false);
    setInfoRenameOpen(false);
    setPollVotesMessageId(null);
    setPollOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
    setMenuOpen(false);
    setAttachOpen(false);
    setActionMessage(null);
    setActionLayout(null);
    setEditingMessage(null);
  }, [clubId, conversationId]);

  useEffect(() => {
    if (!attachOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!attachWrapRef.current?.contains(event.target as Node)) {
        setAttachOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAttachOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [attachOpen]);

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
    setAttachOpen(false);
    setInfoOpen(false);
    setInfoRenameOpen(false);
    setPollVotesMessageId(null);
    setPollOpen(true);
  }
  useEffect(() => {
    setConversationLive(null);
    const unsubConv = watchConversation({
      clubId,
      conversationId,
      onData: setConversationLive,
    });
    const unsubMsgs = watchMessages({
      clubId,
      conversationId,
      messageLimit: REALTIME_MESSAGE_LIMIT,
      onData: (list) => {
        setRealtimeMessages(list);
        setHasMoreOlder((previous) =>
          previous ? previous : list.length >= REALTIME_MESSAGE_LIMIT,
        );
      },
    });
    return () => {
      unsubConv();
      unsubMsgs();
    };
  }, [clubId, conversationId]);

  useEffect(() => {
    const uids = conversation?.participantUids ?? [];
    if (uids.length === 0) {
      setParticipants([]);
      setAllParticipants([]);
      setParticipantsLoading(false);
      return;
    }

    const seeded = seedParticipantsFromPreviewCache({
      clubId,
      participantUids: uids,
      previewSenderByKey: chat?.previewSenderByKey,
      userDisplayNameByUid: chat?.userDisplayNameByUid,
      dmPeerDisplayName: inboxPeerName,
      viewerUid: user?.uid,
    });
    const seededForHeader =
      conversation && !isGroupConversation(conversation) && user
        ? seeded.filter((participant) => participant.uid !== user.uid)
        : seeded;
    if (seeded.length > 0) {
      setAllParticipants(seeded);
      setParticipants(seededForHeader);
    } else {
      setAllParticipants([]);
      setParticipants([]);
    }

    let cancelled = false;
    setParticipantsLoading(true);
    void resolveConversationParticipants({
      clubId,
      participantUids: uids,
    }).then((resolved) => {
      if (cancelled) return;
      setAllParticipants(resolved);
      const filtered =
        conversation && !isGroupConversation(conversation) && user
          ? resolved.filter((participant) => participant.uid !== user.uid)
          : resolved;
      setParticipants(filtered);
      setParticipantsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    clubId,
    conversation,
    user,
    chat?.previewSenderByKey,
    chat?.userDisplayNameByUid,
    inboxPeerName,
  ]);

  const messages = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    for (const message of olderMessages) byId.set(message.id, message);
    for (const message of realtimeMessages) byId.set(message.id, message);
    return [...byId.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }, [olderMessages, realtimeMessages]);

  const threadRows = useMemo(() => {
    const rows: ThreadRow[] = [];
    let previousDay: Date | null = null;
    const anchor = unreadSeparatorAnchorRef.current;
    const firstUnreadByCount =
      anchor?.kind === "count" && anchor.count > 0 && messages.length > 0
        ? Math.max(0, messages.length - anchor.count)
        : null;
    let unreadInserted = false;
    for (let index = 0; index < messages.length; index++) {
      const message = messages[index]!;
      if (
        !previousDay ||
        !isSameCalendarDay(previousDay, message.createdAt)
      ) {
        rows.push({
          kind: "date",
          id: `date-${message.createdAt.toISOString().slice(0, 10)}`,
          label: formatChatDateSeparator(message.createdAt),
        });
        previousDay = message.createdAt;
      }
      const showUnreadHere =
        !unreadInserted &&
        ((firstUnreadByCount !== null && index === firstUnreadByCount) ||
          (anchor?.kind === "after" &&
            message.createdAt.getTime() > anchor.afterMs &&
            message.senderUid !== user?.uid));
      if (showUnreadHere) {
        rows.push({ kind: "unread", id: "unread-separator" });
        unreadInserted = true;
      }
      rows.push({ kind: "message", id: message.id, message });
    }
    return rows;
  }, [messages, user?.uid]);

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1]!.id : null;
  const autoScrollConversationKey = `${clubId}:${conversationId}`;

  /** True si le viewport est proche du bas du fil. */
  function isNearBottom(): boolean {
    const viewport = messagesRef.current;
    if (!viewport) return true;
    return (
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
      NEAR_BOTTOM_PX
    );
  }

  /** Scroll le fil jusqu’aux derniers messages. */
  function scrollMessagesToBottom(smooth: boolean) {
    const viewport = messagesRef.current;
    if (viewport) {
      if (smooth) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      } else {
        viewport.scrollTop = viewport.scrollHeight;
      }
      nearBottomRef.current = true;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    nearBottomRef.current = true;
  }

  useEffect(() => {
    const viewport = messagesRef.current;
    if (!viewport) return;
    const onScroll = () => {
      nearBottomRef.current = isNearBottom();
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [clubId, conversationId]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    if (messages.length === 0) return;
    const isOpeningThread =
      lastAutoScrolledKeyRef.current !== autoScrollConversationKey;
    const forceAfterSend = forceScrollAfterSendRef.current;
    if (forceAfterSend) forceScrollAfterSendRef.current = false;
    if (!isOpeningThread && !nearBottomRef.current && !forceAfterSend) {
      return;
    }
    lastAutoScrolledKeyRef.current = autoScrollConversationKey;
    const smooth = !isOpeningThread;
    // Double passe : layout flex / images peuvent encore grandir après le paint.
    const run = () => scrollMessagesToBottom(smooth);
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }, [autoScrollConversationKey, messages.length, lastMessageId]);

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
    canWrite && conversation != null && isGroupConversation(conversation);
  const isGroup = conversation ? isGroupConversation(conversation) : false;
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
  const roleByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of allParticipants) {
      map.set(participant.uid, participant.role);
    }
    return map;
  }, [allParticipants]);

  const peopleByUid = useMemo(() => {
    const map = new Map<string, ReactionPerson>();
    for (const participant of allParticipants) {
      map.set(participant.uid, {
        uid: participant.uid,
        label: participantFirstName(participant),
        displayName: participant.displayName || participantFirstName(participant),
        avatarUrl: participant.avatarUrl,
        hasLinkedAccount: participant.hasLinkedAccount,
      });
    }
    return map;
  }, [allParticipants]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as string[];
    return messages
      .filter((message) => {
        if (isChatMessageDeleted(message)) return false;
        const text = message.text ?? message.pollQuestion ?? "";
        return text.toLowerCase().includes(q);
      })
      .map((message) => message.id);
  }, [messages, searchQuery]);

  useEffect(() => {
    if (!searchOpen || searchMatches.length === 0) return;
    const firstId = searchMatches[0]!;
    messageRefs.current[firstId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [searchOpen, searchQuery, searchMatches]);

  function replyPayloadFromTarget(target: ChatMessage | null) {
    if (!target || isChatMessageDeleted(target)) return {};
    const preview = replyPreviewText(target);
    if (!preview) return {};
    return {
      replyToMessageId: target.id,
      replyToText: preview.slice(0, 240),
      replyToSenderUid: target.senderUid,
    };
  }

  async function uploadImageFile(file: File) {
    if (!user || !canWrite || busy) return;
    setBusy(true);
    setError(null);
    forceScrollAfterSendRef.current = true;
    try {
      const bytes = await file.arrayBuffer();
      await sendImageMessage({
        clubId,
        conversationId,
        senderUid: user.uid,
        bytes,
        contentType: file.type || "image/jpeg",
        senderFirstName,
        senderRole,
        ...replyPayloadFromTarget(replyTarget),
      });
      setReplyTarget(null);
    } catch {
      forceScrollAfterSendRef.current = false;
      setError("Envoi de la photo impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadOlder() {
    if (loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const oldest = messages[0]!;
    const viewport = messagesRef.current;
    const previousHeight = viewport?.scrollHeight ?? 0;
    setLoadingOlder(true);
    setError(null);
    try {
      const page = await fetchOlderMessages({
        clubId,
        conversationId,
        beforeCreatedAt: oldest.createdAt,
        beforeDocId: oldest.id,
        limit: OLDER_PAGE_SIZE,
      });
      if (page.length === 0) {
        setHasMoreOlder(false);
      } else {
        skipAutoScrollRef.current = true;
        setOlderMessages((current) => {
          const ids = new Set(current.map((message) => message.id));
          const merged = [...current];
          for (const message of page) {
            if (!ids.has(message.id)) merged.push(message);
          }
          merged.sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          );
          return merged;
        });
        setHasMoreOlder(page.length >= OLDER_PAGE_SIZE);
        requestAnimationFrame(() => {
          if (!viewport) return;
          viewport.scrollTop += viewport.scrollHeight - previousHeight;
        });
      }
    } catch {
      setError("Impossible de charger l’historique.");
    } finally {
      setLoadingOlder(false);
    }
  }

  function scrollToMessage(messageId: string) {
    messageRefs.current[messageId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function startReply(message: ChatMessage) {
    if (isChatMessageDeleted(message)) return;
    setActionMessage(null);
    setReplyTarget(message);
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    if (!user || !canWrite || busy) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    forceScrollAfterSendRef.current = true;
    try {
      await sendTextMessage({
        clubId,
        conversationId,
        senderUid: user.uid,
        text,
        senderFirstName,
        senderRole,
        ...replyPayloadFromTarget(replyTarget),
      });
      setDraft("");
      setReplyTarget(null);
    } catch (err) {
      forceScrollAfterSendRef.current = false;
      console.error("[chat] sendTextMessage failed", err);
      const detail =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "erreur inconnue";
      setError(`Envoi impossible. (${detail})`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadImageFile(file);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.items;
    if (!items || !canWrite) return;
    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      void uploadImageFile(file);
      return;
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!canWrite) return;
    event.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!canWrite) return;
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      void uploadImageFile(file);
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

  function openSearch() {
    setMenuOpen(false);
    setInfoOpen(false);
    setSearchOpen(true);
  }

  async function handleDelete(message: ChatMessage) {
    if (!user) return;
    if (!window.confirm("Supprimer ce message ?")) return;
    setActionMessage(null);
    await softDeleteMessage({
      clubId,
      conversationId,
      messageId: message.id,
      deletedByUid: user.uid,
    });
  }

  async function handleCopy(message: ChatMessage) {
    const text = message.text?.trim() ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Copie impossible.");
    }
    setActionMessage(null);
  }

  function openEdit(message: ChatMessage) {
    if (message.type !== ChatMessageTypes.text) return;
    setActionMessage(null);
    setEditingMessage(message);
    setEditDraft(message.text ?? "");
  }

  async function handleEditSave() {
    if (!editingMessage) return;
    const next = editDraft.trim();
    if (!next || next === (editingMessage.text ?? "").trim()) {
      setEditingMessage(null);
      return;
    }
    try {
      await editTextMessage({
        clubId,
        conversationId,
        messageId: editingMessage.id,
        text: next,
      });
      setEditingMessage(null);
    } catch {
      setError("Modification impossible.");
    }
  }

  async function handleReaction(message: ChatMessage, emoji: string) {
    if (!user || isChatMessageDeleted(message)) return;
    setActionMessage(null);
    await toggleReaction({
      clubId,
      conversationId,
      messageId: message.id,
      emoji,
      uid: user.uid,
    });
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function openMessageActions(message: ChatMessage) {
    if (isChatMessageDeleted(message)) return;
    setActionMessage(message);
  }

  const updateActionLayout = useCallback(() => {
    if (!actionMessage) {
      setActionLayout(null);
      return;
    }
    const row = messageRefs.current[actionMessage.id];
    const viewportEl = messagesRef.current;
    // Ancre = la bulle elle-même (pas la row pleine largeur).
    const bubble =
      row?.querySelector<HTMLElement>("[data-msg-bubble]") ?? row;
    if (!bubble || !viewportEl) {
      setActionLayout(null);
      return;
    }
    const mine = user?.uid === actionMessage.senderUid;
    const bubbleRect = bubble.getBoundingClientRect();
    const next = computeAnchoredPopover({
      anchorRect: bubbleRect,
      viewportRect: viewportEl.getBoundingClientRect(),
      // Assez large pour la barre 6 emojis + « + » (évite le clamp qui tronque).
      popupWidth: Math.max(260, Math.min(300, Math.max(bubbleRect.width, 260))),
      estimatedHeight: 300,
      maxHeight: Math.min(360, viewportEl.clientHeight - 16),
      gap: 12,
      alignEnd: mine,
    });
    setActionLayout(next);
  }, [actionMessage, user?.uid]);

  useLayoutEffect(() => {
    updateActionLayout();
  }, [updateActionLayout]);

  useEffect(() => {
    if (!actionMessage) return;
    const viewportEl = messagesRef.current;
    const onScrollOrResize = () => updateActionLayout();
    viewportEl?.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    const scrollParent = findScrollParent(viewportEl);
    if (scrollParent && scrollParent !== viewportEl) {
      scrollParent.addEventListener("scroll", onScrollOrResize, {
        passive: true,
      });
    }
    return () => {
      viewportEl?.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (scrollParent && scrollParent !== viewportEl) {
        scrollParent.removeEventListener("scroll", onScrollOrResize);
      }
    };
  }, [actionMessage, updateActionLayout]);

  function onBubblePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    message: ChatMessage,
  ) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea")) return;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      openMessageActions(message);
    }, LONG_PRESS_MS);
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

  function replyAuthorLabel(senderUid: string | null | undefined): string {
    if (!senderUid) return "Quelqu’un";
    if (senderUid === user?.uid) return "Toi";
    const participant = allParticipants.find((person) => person.uid === senderUid);
    return participant ? participantFirstName(participant) : "Quelqu’un";
  }

  return (
    <div
      className={`${styles.root}${compact ? ` ${styles.rootCompact}` : ""}${sidePanelOpen ? ` ${styles.rootWithInfo}` : ""}`}
      data-info-open={sidePanelOpen ? "true" : undefined}
    >
      <div className={styles.chatColumn}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.headerMain}
          onClick={() => openInfo()}
          aria-label="Infos de la discussion"
        >
          <span className={styles.headerText}>
            <span className={styles.titleRow}>
              <span className={styles.title} title={title}>
                {titleShort}
              </span>
              {favorite ? (
                <span className={styles.favMark} aria-label="Favori">
                  <ChatIcon name="favoriteFill" size={12} />
                </span>
              ) : null}
              {headerExtra ? (
                <span className={styles.headerClubSlot}>{headerExtra}</span>
              ) : null}
            </span>
            {showMembersPreviewSlot ? (
              <span className={styles.membersPreview}>
                {membersPreview || "\u00A0"}
              </span>
            ) : null}
          </span>
        </button>
        <div className={styles.headerActions}>
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Options"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <ChatIcon name="options" size={18} />
            </button>
            {menuOpen ? (
              <div className={styles.menu}>
                <button type="button" onClick={() => openInfo()}>
                  <ChatIcon name="info" size={18} />
                  Infos de la discussion
                </button>
                <button type="button" onClick={openSearch}>
                  <ChatIcon name="search" size={18} />
                  Rechercher un message
                </button>
                <button type="button" onClick={() => void handleToggleMute()}>
                  <ChatIcon name={muted ? "bell" : "mute"} size={18} />
                  {muted ? "Réactiver les notifs" : "Couper les notifs"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleFavorite()}
                >
                  <ChatIcon
                    name={favorite ? "favoriteFill" : "favorite"}
                    size={18}
                  />
                  {favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                </button>
                {isGroup ? (
                  <button
                    type="button"
                    onClick={() => openInfo({ rename: true })}
                  >
                    <ChatIcon name="edit" size={18} />
                    Renommer
                  </button>
                ) : null}
                {canPoll ? (
                  <button type="button" onClick={openCreatePoll}>
                    <ChatIcon name="poll" size={18} />
                    Faire un sondage
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
              <ChatIcon name="maximize" size={16} />
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Fermer"
              onClick={onClose}
            >
              <ChatIcon name="close" size={16} />
            </button>
          ) : null}
        </div>
      </header>

      {searchOpen ? (
        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Rechercher dans la discussion"
            value={searchQuery}
            autoFocus
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <span className={styles.searchMeta}>
            {searchQuery.trim()
              ? `${searchMatches.length} résultat${searchMatches.length > 1 ? "s" : ""}`
              : ""}
          </span>
          <button
            type="button"
            className={styles.searchClose}
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
          >
            Fermer
          </button>
        </div>
      ) : null}

      <div
        className={`${styles.messages}${dragOver ? ` ${styles.messagesDragOver}` : ""}`}
        ref={messagesRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(event) => void handleDrop(event)}
      >
        {isGroup ? (
          <ConversationIntroCard
            title={title}
            clubName={clubName}
            clubColor={clubColor}
            participants={participants}
            onOpenInfo={() => openInfo()}
          />
        ) : null}
        {hasMoreOlder ? (
          <button
            type="button"
            className={styles.loadMoreBtn}
            disabled={loadingOlder}
            onClick={() => void handleLoadOlder()}
          >
            {loadingOlder ? "Chargement…" : "Charger plus"}
          </button>
        ) : null}
        {threadRows.length === 0 ? (
          <p className={styles.emptyHint}>
            Pas encore de messages. Lance-toi.
          </p>
        ) : (
          threadRows.map((row) => {
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
            const mine = user?.uid === message.senderUid;
            const deleted = isChatMessageDeleted(message);
            const roleTone = senderRoleTone(roleByUid.get(message.senderUid));
            const showSenderMeta = isGroup && !mine;
            const senderPerson = showSenderMeta
              ? peopleByUid.get(message.senderUid)
              : undefined;
            const senderLabel = showSenderMeta
              ? senderPerson?.displayName?.trim() ||
                senderPerson?.label ||
                "Quelqu’un"
              : null;
            const isMatch =
              searchOpen &&
              searchQuery.trim() &&
              searchMatches.includes(message.id);
            const timeLabel = deleted ? "" : messageTimeLabel(message);
            const timeIso = deleted
              ? undefined
              : message.createdAt.toISOString();
            const hasReply =
              !deleted &&
              Boolean(message.replyToMessageId && message.replyToText);
            const hasReactions =
              !deleted &&
              Object.values(message.reactions).some((uids) => uids.length > 0);
            return (
              <div
                key={message.id}
                ref={(node) => {
                  messageRefs.current[message.id] = node;
                }}
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
                        senderPerson?.displayName ||
                        senderPerson?.label ||
                        "Membre"
                      }
                      avatarUrl={senderPerson?.avatarUrl}
                      hasLinkedAccount={
                        senderPerson?.hasLinkedAccount ?? false
                      }
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
                      openMessageActions(message);
                    }}
                    onPointerDown={(event) =>
                      onBubblePointerDown(event, message)
                    }
                    onPointerUp={clearLongPressTimer}
                    onPointerLeave={clearLongPressTimer}
                    onPointerCancel={clearLongPressTimer}
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
                          scrollToMessage(message.replyToMessageId);
                        }
                      }}
                    >
                      <span className={styles.quoteAuthor}>
                        {replyAuthorLabel(message.replyToSenderUid)}
                      </span>
                      <span className={styles.quoteText}>
                        {message.replyToText}
                      </span>
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
                          const fullUrl =
                            message.downloadUrl ||
                            message.thumbUrl ||
                            "";
                          if (fullUrl) setLightboxUrl(fullUrl);
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
                      <time
                        className={styles.timeOnImage}
                        dateTime={timeIso}
                      >
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
                          openPollVotes(message.id);
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
                      myUid={user?.uid}
                      peopleByUid={peopleByUid}
                      mine={mine}
                      onToggle={(emoji) => void handleReaction(message, emoji)}
                    />
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
          {replyTarget ? (
            <div className={styles.replyBanner}>
              <div className={styles.replyBannerText}>
                <span className={styles.replyBannerLabel}>Réponse à</span>
                <span className={styles.replyBannerQuote}>
                  {replyAuthorLabel(replyTarget.senderUid)} ·{" "}
                  {replyPreviewText(replyTarget)}
                </span>
              </div>
              <button
                type="button"
                className={styles.replyBannerClose}
                aria-label="Annuler la réponse"
                onClick={() => setReplyTarget(null)}
              >
                <ChatIcon name="close" size={14} />
              </button>
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void handleImage(e)}
          />
          <div className={styles.composerRow}>
          <div className={styles.attachWrap} ref={attachWrapRef}>
            <button
              type="button"
              className={`${styles.plusBtn}${attachOpen ? ` ${styles.plusBtnOpen}` : ""}`}
              aria-label="Ajouter"
              aria-expanded={attachOpen}
              aria-haspopup="menu"
              disabled={busy}
              onClick={() => setAttachOpen((open) => !open)}
            >
              <ChatIcon name="plus" size={18} />
            </button>
            {attachOpen ? (
              <div className={styles.attachMenu} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    setAttachOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <span
                    className={styles.attachIcon}
                    data-tone="photos"
                    aria-hidden
                  >
                    <ChatIcon name="image" size={13} />
                  </span>
                  Photos
                </button>
                {canPoll ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={openCreatePoll}
                  >
                    <span
                      className={styles.attachIcon}
                      data-tone="poll"
                      aria-hidden
                    >
                      <ChatIcon name="poll" size={13} />
                    </span>
                    Faire un sondage
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <textarea
            className={styles.input}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
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
          </div>
        </form>
      ) : (
        <p className={styles.readonly}>
          Seuls les admins peuvent écrire ici.
        </p>
      )}

      </div>

      {pollOpen ? (
        <CreatePollSheet
          onClose={() => setPollOpen(false)}
          onSubmit={async (payload) => {
            if (!user) return;
            forceScrollAfterSendRef.current = true;
            await sendPollMessage({
              clubId,
              conversationId,
              senderUid: user.uid,
              question: payload.question,
              optionTexts: payload.options,
              allowMultiple: payload.allowMultiple,
              senderFirstName,
              senderRole,
            });
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
          initialRenameOpen={infoRenameOpen}
        />
      ) : null}

      {actionMessage
        ? createPortal(
            <div
              className={styles.actionOverlay}
              onClick={() => setActionMessage(null)}
              role="presentation"
            >
              {actionLayout ? (
                <div
                  className={`${styles.actionStack}${
                    actionLayout.placement === "above"
                      ? ` ${styles.actionStackAbove}`
                      : ""
                  }`}
                  style={
                    {
                      left: actionLayout.left,
                      top: actionLayout.top,
                      width: actionLayout.width,
                      maxHeight: actionLayout.maxHeight,
                      alignItems:
                        user?.uid === actionMessage.senderUid
                          ? "flex-end"
                          : "flex-start",
                    } satisfies CSSProperties
                  }
                  onClick={(event) => event.stopPropagation()}
                >
                  <ReactionQuickBar
                    onPick={(emoji) =>
                      void handleReaction(actionMessage, emoji)
                    }
                  />
                  <div
                    className={styles.actionSheet}
                    role="dialog"
                    aria-label="Actions du message"
                  >
                    {canWrite ? (
                      <button
                        type="button"
                        className={styles.actionItem}
                        onClick={() => startReply(actionMessage)}
                      >
                        <ChatIcon name="reply" size={18} />
                        Répondre
                      </button>
                    ) : null}
                    {actionMessage.type === ChatMessageTypes.text &&
                    (actionMessage.text ?? "").trim() ? (
                      <button
                        type="button"
                        className={styles.actionItem}
                        onClick={() => void handleCopy(actionMessage)}
                      >
                        <ChatIcon name="copy" size={18} />
                        Copier
                      </button>
                    ) : null}
                    {user?.uid === actionMessage.senderUid &&
                    actionMessage.type === ChatMessageTypes.text ? (
                      <button
                        type="button"
                        className={styles.actionItem}
                        onClick={() => openEdit(actionMessage)}
                      >
                        <ChatIcon name="edit" size={18} />
                        Modifier
                      </button>
                    ) : null}
                    {user?.uid === actionMessage.senderUid ? (
                      <button
                        type="button"
                        className={`${styles.actionItem} ${styles.actionDanger}`}
                        onClick={() => void handleDelete(actionMessage)}
                      >
                        <ChatIcon name="trash" size={18} />
                        Supprimer
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {lightboxUrl ? (
        <div
          className={styles.lightbox}
          onClick={() => setLightboxUrl(null)}
          role="presentation"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Photo en plein écran"
            className={styles.lightboxImage}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className={styles.lightboxClose}
            aria-label="Fermer"
            onClick={() => setLightboxUrl(null)}
          >
            <ChatIcon name="close" size={20} />
          </button>
        </div>
      ) : null}

      {editingMessage ? (
        <div
          className={styles.editOverlay}
          onClick={() => setEditingMessage(null)}
          role="presentation"
        >
          <div
            className={styles.actionSheet}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Modifier le message"
          >
            <div className={styles.editFieldWrap}>
              <textarea
                className={styles.editField}
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
                rows={4}
                autoFocus
              />
            </div>
            <button
              type="button"
              className={styles.actionItem}
              onClick={() => void handleEditSave()}
            >
              <ChatIcon name="edit" size={18} />
              Enregistrer
            </button>
            <button
              type="button"
              className={styles.actionItem}
              onClick={() => setEditingMessage(null)}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
