"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { FloatingThread } from "@/components/chat/FloatingThread";
import { MessagingDock } from "@/components/chat/MessagingDock";
import { ComposeConversationDialog } from "@/components/chat/ComposeConversationDialog";
import { CreateCategoryChannelDialog } from "@/components/chat/CreateCategoryChannelDialog";
import {
  previewSenderKey,
  type ChatPreviewSender,
} from "@/lib/chat/conversationPreview";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  ensureClubsChatSynced,
  messagesPagePath,
  totalUnreadCount,
  watchChatStates,
  watchInbox,
} from "@/lib/firebase/chatService";
import {
  chatStateDocId,
  dmPeerUid,
  type ChatConversation,
  type ChatThreadKey,
  type ChatUserState,
} from "@/lib/firebase/chatTypes";
import { MemberRoles, PortalUiRoles } from "@/lib/firebase/constants";
import { listClubMembers } from "@/lib/firebase/memberService";
import { membershipRoleForClub, splitDisplayName } from "@/lib/firebase/types";
import { getUserProfile } from "@/lib/firebase/userService";
import { CHAT_MESSAGING_LIVE } from "@/lib/featureFlags";

type ChatContextValue = {
  dockOpen: boolean;
  dockExpanded: boolean;
  composeOpen: boolean;
  categoryChannelOpen: boolean;
  isAdminSomewhere: boolean;
  activeThread: ChatThreadKey | null;
  conversations: ChatConversation[];
  chatStates: Record<string, ChatUserState>;
  totalUnread: number;
  inboxLoading: boolean;
  clubNameById: Record<string, string>;
  clubColorById: Record<string, string | null>;
  /** Annuaire `clubId:uid` → prénom + rôle (fallback preview). */
  previewSenderByKey: Record<string, ChatPreviewSender>;
  /**
   * Titres DM résolus pour le viewer : `clubId_convId` → nom du pair.
   * Évite d’afficher son propre nom (titre figé à la création).
   */
  dmPeerNameByKey: Record<string, string>;
  /** Display names profils (`uid` → nom), ex. parents hors fiche membre. */
  userDisplayNameByUid: Record<string, string>;
  messagesHref: string;
  isMobileLayout: boolean;
  toggleDock: () => void;
  setDockOpen: (open: boolean) => void;
  setDockExpanded: (expanded: boolean) => void;
  openCompose: () => void;
  closeCompose: () => void;
  openCategoryChannel: () => void;
  closeCategoryChannel: () => void;
  openThread: (thread: ChatThreadKey) => void;
  closeFloatingThread: () => void;
  maximizeThread: () => void;
  roleForClub: (clubId: string) => string | null;
};

const ChatContext = createContext<ChatContextValue | null>(null);

const MOBILE_MQ = "(max-width: 767px)";

function isMessagesPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/family/messages" ||
    pathname.startsWith("/family/messages/")
  );
}

/**
 * Quand la messagerie est désactivée : pas de chrome, redirige les deep links.
 */
function ChatMessagingDisabled({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isMessagesPath(pathname)) return;
    const fallback = pathname.startsWith("/family") ? "/family" : "/home";
    router.replace(fallback);
  }, [pathname, router]);

  return <>{children}</>;
}

/**
 * État messagerie global (dock + 1 fenêtre flottante).
 * Survit aux changements de module / club / espace bureau↔famille.
 * Inactif si `CHAT_MESSAGING_LIVE` est faux (feature non déployée sur l’app).
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  if (!CHAT_MESSAGING_LIVE) {
    return <ChatMessagingDisabled>{children}</ChatMessagingDisabled>;
  }
  return <ChatProviderLive>{children}</ChatProviderLive>;
}

/** Implémentation live (abonnements Firestore + dock). */
function ChatProviderLive({ children }: { children: ReactNode }) {
  const {
    user,
    status,
    profile,
    activeSpace,
    bureauClubs,
    familyClubs,
  } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [dockOpen, setDockOpen] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [categoryChannelOpen, setCategoryChannelOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<ChatThreadKey | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [chatStates, setChatStates] = useState<Record<string, ChatUserState>>(
    {},
  );
  const [inboxLoading, setInboxLoading] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [previewSenderByKey, setPreviewSenderByKey] = useState<
    Record<string, ChatPreviewSender>
  >({});
  /** Annuaire `clubId:uid` → displayName (membres club). */
  const [memberDisplayNameByKey, setMemberDisplayNameByKey] = useState<
    Record<string, string>
  >({});
  const [dmPeerNameByKey, setDmPeerNameByKey] = useState<
    Record<string, string>
  >({});
  /** Noms profils résolus (parents hors membres) : `uid` → displayName. */
  const [userDisplayNameByUid, setUserDisplayNameByUid] = useState<
    Record<string, string>
  >({});

  const syncedClubsRef = useRef<string>("");

  const clubIds = useMemo(() => {
    const ids = new Set<string>();
    for (const club of bureauClubs) ids.add(club.id);
    for (const club of familyClubs) ids.add(club.id);
    return [...ids];
  }, [bureauClubs, familyClubs]);

  const clubNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const club of [...bureauClubs, ...familyClubs]) {
      map[club.id] = club.name;
    }
    return map;
  }, [bureauClubs, familyClubs]);

  const clubColorById = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const club of [...bureauClubs, ...familyClubs]) {
      map[club.id] = club.brandColorHex;
    }
    return map;
  }, [bureauClubs, familyClubs]);

  const messagesHref = messagesPagePath(
    activeSpace === "family" ? "family" : "bureau",
  );

  const onMessagesPage =
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/family/messages" ||
    pathname.startsWith("/family/messages/");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(MOBILE_MQ);
    const update = () => setIsMobileLayout(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!onMessagesPage) return;
    setDockOpen(false);
    setActiveThread(null);
  }, [onMessagesPage]);

  useEffect(() => {
    if (status !== "signedIn" || !user || clubIds.length === 0) {
      setConversations([]);
      setChatStates({});
      setInboxLoading(false);
      return;
    }

    setInboxLoading(true);
    const clubKey = clubIds.slice().sort().join(",");
    if (syncedClubsRef.current !== clubKey) {
      syncedClubsRef.current = clubKey;
      void ensureClubsChatSynced(clubIds);
    }

    const unsubInbox = watchInbox({
      uid: user.uid,
      clubIds,
      onData: (list) => {
        setConversations(list);
        setInboxLoading(false);
      },
      onError: () => setInboxLoading(false),
    });
    const unsubStates = watchChatStates({
      uid: user.uid,
      onData: setChatStates,
    });

    return () => {
      unsubInbox();
      unsubStates();
    };
  }, [status, user, clubIds]);

  useEffect(() => {
    if (status !== "signedIn" || clubIds.length === 0) {
      setPreviewSenderByKey({});
      setMemberDisplayNameByKey({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const directory: Record<string, ChatPreviewSender> = {};
      const displayNames: Record<string, string> = {};
      await Promise.all(
        clubIds.map(async (clubId) => {
          try {
            const members = await listClubMembers(clubId);
            for (const member of members) {
              if (!member.accountUid) continue;
              const key = previewSenderKey(clubId, member.accountUid);
              const displayName = member.displayName.trim();
              if (displayName) displayNames[key] = displayName;
              const firstName =
                member.firstName.trim() ||
                splitDisplayName(member.displayName).firstName;
              if (!firstName) continue;
              directory[key] = {
                firstName,
                role: member.role,
              };
            }
          } catch {
            // Lecture membres optionnelle pour la preview.
          }
        }),
      );
      if (!cancelled) {
        setPreviewSenderByKey(directory);
        setMemberDisplayNameByKey(displayNames);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, clubIds]);

  useEffect(() => {
    if (!user || conversations.length === 0) {
      setDmPeerNameByKey({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      const missingUids = new Set<string>();

      for (const conversation of conversations) {
        const peerUid = dmPeerUid(conversation, user.uid);
        if (!peerUid) continue;
        const memberKey = previewSenderKey(conversation.clubId, peerUid);
        const fromMember = memberDisplayNameByKey[memberKey]?.trim();
        if (fromMember) {
          next[chatStateDocId(conversation.clubId, conversation.id)] =
            fromMember;
        } else {
          missingUids.add(peerUid);
        }
      }

      const profileNameByUid = new Map<string, string>();
      await Promise.all(
        [...missingUids].map(async (uid) => {
          try {
            const profile = await getUserProfile(uid);
            if (!profile) return;
            const name =
              profile.displayName.trim() ||
              [profile.firstName, profile.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
            if (name) profileNameByUid.set(uid, name);
          } catch {
            // Best-effort.
          }
        }),
      );

      for (const conversation of conversations) {
        const peerUid = dmPeerUid(conversation, user.uid);
        if (!peerUid) continue;
        const convKey = chatStateDocId(conversation.clubId, conversation.id);
        if (next[convKey]) continue;
        const fromProfile = profileNameByUid.get(peerUid);
        if (fromProfile) next[convKey] = fromProfile;
      }

      if (!cancelled) {
        setDmPeerNameByKey(next);
        if (profileNameByUid.size > 0) {
          setUserDisplayNameByUid((previous) => {
            const merged = { ...previous };
            for (const [uid, name] of profileNameByUid) {
              merged[uid] = name;
            }
            return merged;
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, conversations, memberDisplayNameByKey]);

  const totalUnread = useMemo(
    () => totalUnreadCount(chatStates, conversations, user?.uid),
    [chatStates, conversations, user?.uid],
  );

  const familyClubIdSet = useMemo(
    () => new Set(familyClubs.map((club) => club.id)),
    [familyClubs],
  );

  const roleForClub = useCallback(
    (clubId: string) => {
      const membershipRole = membershipRoleForClub(profile, clubId);
      if (membershipRole) return membershipRole;
      if (familyClubIdSet.has(clubId)) return PortalUiRoles.parent;
      return null;
    },
    [profile, familyClubIdSet],
  );

  const toggleDock = useCallback(() => {
    setDockOpen((previous) => {
      const next = !previous;
      if (next) setDockExpanded(true);
      return next;
    });
  }, []);

  const openCompose = useCallback(() => setComposeOpen(true), []);
  const closeCompose = useCallback(() => setComposeOpen(false), []);
  const openCategoryChannel = useCallback(
    () => setCategoryChannelOpen(true),
    [],
  );
  const closeCategoryChannel = useCallback(
    () => setCategoryChannelOpen(false),
    [],
  );

  const isAdminSomewhere = useMemo(
    () =>
      bureauClubs.some(
        (club) => membershipRoleForClub(profile, club.id) === MemberRoles.admin,
      ),
    [bureauClubs, profile],
  );

  const openThread = useCallback(
    (thread: ChatThreadKey) => {
      setActiveThread(thread);
      setDockOpen(true);
      setDockExpanded(true);
      if (isMobileLayout || onMessagesPage) {
        router.push(
          messagesPagePath(
            activeSpace === "family" ? "family" : "bureau",
            thread,
          ),
        );
        setActiveThread(null);
      }
    },
    [isMobileLayout, onMessagesPage, router, activeSpace],
  );

  const closeFloatingThread = useCallback(() => {
    setActiveThread(null);
  }, []);

  const maximizeThread = useCallback(() => {
    if (!activeThread) {
      router.push(messagesHref);
      return;
    }
    router.push(
      messagesPagePath(
        activeSpace === "family" ? "family" : "bureau",
        activeThread,
      ),
    );
    setActiveThread(null);
  }, [activeThread, router, messagesHref, activeSpace]);

  const value = useMemo<ChatContextValue>(
    () => ({
      dockOpen,
      dockExpanded,
      composeOpen,
      categoryChannelOpen,
      isAdminSomewhere,
      activeThread,
      conversations,
      chatStates,
      totalUnread,
      inboxLoading,
      clubNameById,
      clubColorById,
      previewSenderByKey,
      dmPeerNameByKey,
      userDisplayNameByUid,
      messagesHref,
      isMobileLayout,
      toggleDock,
      setDockOpen,
      setDockExpanded,
      openCompose,
      closeCompose,
      openCategoryChannel,
      closeCategoryChannel,
      openThread,
      closeFloatingThread,
      maximizeThread,
      roleForClub,
    }),
    [
      dockOpen,
      dockExpanded,
      composeOpen,
      categoryChannelOpen,
      isAdminSomewhere,
      activeThread,
      conversations,
      chatStates,
      totalUnread,
      inboxLoading,
      clubNameById,
      clubColorById,
      previewSenderByKey,
      dmPeerNameByKey,
      userDisplayNameByUid,
      messagesHref,
      isMobileLayout,
      toggleDock,
      openCompose,
      closeCompose,
      openCategoryChannel,
      closeCategoryChannel,
      openThread,
      closeFloatingThread,
      maximizeThread,
      roleForClub,
    ],
  );

  const showChrome =
    status === "signedIn" && user != null && clubIds.length > 0;

  return (
    <ChatContext.Provider value={value}>
      {children}
      {showChrome ? (
        <>
          {!onMessagesPage ? <MessagingDock /> : null}
          {!isMobileLayout && !onMessagesPage && activeThread ? (
            <FloatingThread thread={activeThread} />
          ) : null}
          {composeOpen ? <ComposeConversationDialog /> : null}
          {categoryChannelOpen ? <CreateCategoryChannelDialog /> : null}
        </>
      ) : null}
    </ChatContext.Provider>
  );
}

/** Accès au contexte messagerie (lance si hors ChatProvider live). */
export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat doit être utilisé dans ChatProvider.");
  }
  return ctx;
}

/** Accès optionnel (null si messagerie désactivée / hors provider live). */
export function useChatOptional(): ChatContextValue | null {
  return useContext(ChatContext);
}
