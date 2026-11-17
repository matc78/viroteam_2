"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { AvatarLightbox } from "@/components/dashboard/AvatarLightbox";
import { MemberAvatar } from "@/components/dashboard/MemberAvatar";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { extractConversationMedia } from "@/lib/chat/extractConversationMedia";
import {
  participantFirstName,
  type ConversationParticipant,
} from "@/lib/chat/conversationParticipants";
import {
  readableTextOnBrand,
  splitBrandColorHex,
} from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import {
  canEditGroupAvatar,
  chatDisplayTitle,
  conversationGroupAvatarTone,
  isChannelConversation,
  isGroupConversation,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import styles from "./ConversationInfoPanel.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type ConversationInfoPanelProps = {
  conversation: ChatConversation;
  messages: ChatMessage[];
  participants: ConversationParticipant[];
  participantsLoading: boolean;
  clubName?: string;
  clubColor?: string | null;
  muted: boolean;
  favorite: boolean;
  onClose: () => void;
  onSearch: () => void;
  onToggleMute: () => void;
  onToggleFavorite: () => void;
  onRename: (title: string) => Promise<void>;
  /** Upload avatar groupe (fichier image). */
  onChangeAvatar?: (file: File) => Promise<void>;
  /** Ouvre directement le dialog renommer. */
  initialRenameOpen?: boolean;
};

/**
 * Panneau infos discussion (layout type WhatsApp) : profil, actions, réglages, membres.
 */
export function ConversationInfoPanel({
  conversation,
  messages,
  participants,
  participantsLoading,
  clubName,
  clubColor,
  muted,
  favorite,
  onClose,
  onSearch,
  onToggleMute,
  onToggleFavorite,
  onRename,
  onChangeAvatar,
  initialRenameOpen = false,
}: ConversationInfoPanelProps) {
  const isGroup = isGroupConversation(conversation);
  const isChannel = isChannelConversation(conversation);
  const avatarTone = conversationGroupAvatarTone(conversation);
  const canEditAvatar = canEditGroupAvatar(conversation) && !!onChangeAvatar;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  // Escape : retour aux infos depuis une fiche membre, sinon fermeture.
  const panelRef = useDialogA11y({
    onClose: () => (selectedUid ? setSelectedUid(null) : onClose()),
    modal: false,
  });
  const [renameOpen, setRenameOpen] = useState(initialRenameOpen);
  const renameDialogRef = useDialogA11y({
    onClose: () => setRenameOpen(false),
    enabled: renameOpen,
  });
  const dmOther =
    !isGroup && participants.length > 0
      ? participants[0] ?? null
      : null;
  const title = chatDisplayTitle(conversation, {
    peerDisplayName: dmOther?.displayName,
  });
  const [renameDraft, setRenameDraft] = useState(title);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameFieldId = useId();
  const [mediaOpen, setMediaOpen] = useState(false);

  const brand = splitBrandColorHex(
    clubColor ?? ClubSetupDefaults.brandColorHex,
  ).primary;
  const brandText = readableTextOnBrand(brand);
  const media = useMemo(
    () => extractConversationMedia(messages),
    [messages],
  );
  const mediaCount = media.images.length + media.links.length;
  const memberCount = participants.length;
  const memberLabel = chatCopy.memberCount(memberCount);
  const groupAvatarUrl =
    isGroup && !isChannel ? conversation.avatarUrl?.trim() || null : null;
  const heroToneClass =
    avatarTone === "channel"
      ? styles.heroAvatarChannel
      : avatarTone === "team"
        ? styles.heroAvatarTeam
        : avatarTone === "parents"
          ? styles.heroAvatarParents
          : styles.heroAvatarGroup;

  const selected = selectedUid
    ? participants.find((participant) => participant.uid === selectedUid) ??
      null
    : null;

  async function handleRenameSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = renameDraft.trim();
    if (!trimmed || renameBusy) return;
    setRenameBusy(true);
    setRenameError(null);
    try {
      await onRename(trimmed);
      setRenameOpen(false);
    } catch {
      setRenameError(chatCopy.renameFailed);
    } finally {
      setRenameBusy(false);
    }
  }

  function openRename() {
    setRenameDraft(title);
    setRenameError(null);
    setRenameOpen(true);
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file || !onChangeAvatar || avatarBusy) return;
    setAvatarBusy(true);
    try {
      await onChangeAvatar(file);
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  if (selected) {
    return (
      <aside
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-label={chatCopy.memberCard}
      >
        <header className={styles.header}>
          <button
            type="button"
            className={styles.headerIconBtn}
            aria-label={chatCopy.back}
            onClick={() => setSelectedUid(null)}
          >
            <ChatIcon name="close" size={20} />
          </button>
          <h2 className={styles.headerTitle}>{chatCopy.contactInfo}</h2>
        </header>
        <div className={styles.memberDetail}>
          <MemberAvatar
            displayName={selected.displayName}
            avatarUrl={selected.avatarUrl}
            hasLinkedAccount={selected.hasLinkedAccount}
            diameter="var(--chat-avatar-hero)"
          />
          <h3 className={styles.memberName}>{selected.displayName}</h3>
          <RoleBadge role={selected.role} size="sm" />
        </div>
      </aside>
    );
  }

  const heroFallbackStyle =
    !isGroup && !groupAvatarUrl
      ? ({
          background: `color-mix(in srgb, ${brand} 28%, var(--color-surface-card))`,
          color: brand,
        } as CSSProperties)
      : undefined;

  const heroAvatarInner = groupAvatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={groupAvatarUrl} alt="" className={styles.heroAvatarImg} />
  ) : isGroup ? (
    <ChatIcon
      name={isChannel ? "megaphone" : "usersThree"}
      size={40}
    />
  ) : (
    title.trim().slice(0, 1).toUpperCase() || "?"
  );

  const heroAvatarClass = [
    styles.heroAvatar,
    isGroup && !groupAvatarUrl ? heroToneClass : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-label={chatCopy.conversationInfo}
    >
      <header className={styles.header}>
        <button
          type="button"
          className={styles.headerIconBtn}
          aria-label={chatCopy.close}
          onClick={onClose}
        >
          <ChatIcon name="close" size={20} />
        </button>
        <h2 className={styles.headerTitle}>
          {isGroup ? chatCopy.groupInfo : chatCopy.directInfo}
        </h2>
      </header>

      <div className={styles.scrollBody}>
        <div className={styles.hero}>
          {groupAvatarUrl ? (
            <button
              type="button"
              className={styles.heroAvatarBtn}
              aria-label={
                canEditAvatar
                  ? chatCopy.enlargeGroupPhoto
                  : chatCopy.enlargePhoto
              }
              disabled={avatarBusy}
              onClick={() => setAvatarLightboxOpen(true)}
            >
              <span className={heroAvatarClass} style={heroFallbackStyle}>
                {heroAvatarInner}
              </span>
              {canEditAvatar ? (
                <span className={styles.heroAvatarBadge} aria-hidden>
                  <ChatIcon name="image" size={14} />
                </span>
              ) : null}
            </button>
          ) : canEditAvatar ? (
            <button
              type="button"
              className={styles.heroAvatarBtn}
              aria-label={chatCopy.changeGroupPhoto}
              disabled={avatarBusy}
              onClick={() => avatarInputRef.current?.click()}
            >
              <span className={heroAvatarClass} style={heroFallbackStyle}>
                {heroAvatarInner}
              </span>
              <span className={styles.heroAvatarBadge} aria-hidden>
                <ChatIcon name="image" size={14} />
              </span>
            </button>
          ) : (
            <span
              className={heroAvatarClass}
              style={heroFallbackStyle}
              aria-hidden
            >
              {heroAvatarInner}
            </span>
          )}
          {canEditAvatar ? (
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className={styles.fileInput}
              onChange={(event) => void handleAvatarFileChange(event)}
            />
          ) : null}
          {avatarLightboxOpen && groupAvatarUrl ? (
            <AvatarLightbox
              src={groupAvatarUrl}
              alt={chatCopy.photoOfAlt(title)}
              onClose={() => setAvatarLightboxOpen(false)}
              onEdit={
                canEditAvatar
                  ? () => avatarInputRef.current?.click()
                  : undefined
              }
            />
          ) : null}

          <div className={styles.heroTitleRow}>
            <h3 className={styles.heroTitle}>{title}</h3>
            {isGroup ? (
              <button
                type="button"
                className={styles.editNameBtn}
                aria-label={chatCopy.renameConversation}
                onClick={openRename}
              >
                <ChatIcon name="edit" size={18} />
              </button>
            ) : null}
          </div>

          <p className={styles.heroMeta}>
            {isGroup ? (
              <>
                {chatCopy.groupKind} ·{" "}
                <span className={styles.heroMetaAccent} style={{ color: brand }}>
                  {memberLabel}
                </span>
              </>
            ) : (
              chatCopy.directKind
            )}
          </p>

          {clubName ? (
            <span
              className={styles.clubChip}
              style={
                {
                  "--club-brand": brand,
                  "--club-brand-text": brandText,
                } as CSSProperties
              }
            >
              {clubName}
            </span>
          ) : null}
        </div>

        <div className={styles.quickActions}>
          <button type="button" className={styles.quickBtn} onClick={onSearch}>
            <span className={styles.quickIcon}>
              <ChatIcon name="search" size={22} />
            </span>
            {chatCopy.searchAction}
          </button>
          <button
            type="button"
            className={styles.quickBtn}
            aria-label={muted ? chatCopy.unmute : chatCopy.mute}
            onClick={onToggleMute}
          >
            <span className={styles.quickIcon}>
              <ChatIcon name={muted ? "bell" : "mute"} size={22} />
            </span>
            {muted ? chatCopy.unmuteAction : chatCopy.muteAction}
          </button>
          <button
            type="button"
            className={styles.quickBtn}
            aria-label={favorite ? chatCopy.removeFavorite : chatCopy.addFavorite}
            onClick={onToggleFavorite}
          >
            <span className={styles.quickIcon}>
              <ChatIcon
                name={favorite ? "favoriteFill" : "favorite"}
                size={22}
              />
            </span>
            {chatCopy.favoritesAction}
          </button>
        </div>

        <section className={styles.block}>
          <button
            type="button"
            className={styles.listRow}
            onClick={() => setMediaOpen((open) => !open)}
          >
            <span className={styles.listIcon} aria-hidden>
              <ChatIcon name="image" size={22} />
            </span>
            <span className={styles.listBody}>
              <span className={styles.listLabel}>
                {chatCopy.conversationMedia}
              </span>
            </span>
            <span className={styles.listMeta}>{mediaCount}</span>
          </button>

          {mediaOpen ? (
            <div className={styles.mediaExpand}>
              {mediaCount === 0 ? (
                <p className={styles.empty}>{chatCopy.noConversationMedia}</p>
              ) : (
                <>
                  {media.images.length > 0 ? (
                    <div className={styles.imageGrid}>
                      {media.images.map((image) => (
                        <a
                          key={image.messageId}
                          href={image.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.imageThumb}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.url} alt={chatCopy.sharedPhotoAlt} />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {media.links.length > 0 ? (
                    <ul className={styles.linkList}>
                      {media.links.map((link) => (
                        <li key={`${link.messageId}-${link.url}`}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {link.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <button
            type="button"
            className={styles.listRow}
            onClick={onToggleFavorite}
          >
            <span className={styles.listIcon} aria-hidden>
              <ChatIcon
                name={favorite ? "favoriteFill" : "favorite"}
                size={22}
              />
            </span>
            <span className={styles.listBody}>
              <span className={styles.listLabel}>
                {chatCopy.importantMessages}
              </span>
              <span className={styles.listHint}>
                {favorite ? chatCopy.inFavorites : chatCopy.notInFavorites}
              </span>
            </span>
          </button>

          <button
            type="button"
            className={styles.listRow}
            onClick={onToggleMute}
          >
            <span className={styles.listIcon} aria-hidden>
              <ChatIcon name={muted ? "mute" : "bell"} size={22} />
            </span>
            <span className={styles.listBody}>
              <span className={styles.listLabel}>
                {chatCopy.notificationSettings}
              </span>
              <span className={styles.listHint}>
                {muted
                  ? chatCopy.mutedNotifications
                  : chatCopy.allNotifications}
              </span>
            </span>
          </button>
        </section>

        {isGroup ? (
          <section className={styles.block}>
            <div className={styles.membersHeader}>
              <h4 className={styles.membersTitle}>{memberLabel}</h4>
              <button
                type="button"
                className={styles.membersSearch}
                aria-label={chatCopy.searchMessagesHint}
                onClick={onSearch}
              >
                <ChatIcon name="search" size={18} />
              </button>
            </div>
            {participantsLoading ? (
              <p className={styles.emptyPad}>{chatCopy.membersLoading}</p>
            ) : participants.length === 0 ? (
              <p className={styles.emptyPad}>{chatCopy.noMembersResolved}</p>
            ) : (
              <ul className={styles.memberList}>
                {participants.map((participant) => (
                  <li key={participant.uid}>
                    <button
                      type="button"
                      className={styles.memberRow}
                      onClick={() => setSelectedUid(participant.uid)}
                    >
                      <MemberAvatar
                        displayName={participant.displayName}
                        avatarUrl={participant.avatarUrl}
                        hasLinkedAccount={participant.hasLinkedAccount}
                        diameter="var(--chat-avatar-sender)"
                        enableZoom={false}
                      />
                      <span className={styles.memberRowText}>
                        <span className={styles.memberFirst}>
                          {participantFirstName(participant)}
                        </span>
                      </span>
                      <RoleBadge role={participant.role} size="sm" iconOnly />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : dmOther ? (
          <section className={styles.block}>
            <div className={styles.membersHeader}>
              <h4 className={styles.membersTitle}>{chatCopy.contactSection}</h4>
            </div>
            <button
              type="button"
              className={styles.memberRow}
              onClick={() => setSelectedUid(dmOther.uid)}
            >
              <MemberAvatar
                displayName={dmOther.displayName}
                avatarUrl={dmOther.avatarUrl}
                hasLinkedAccount={dmOther.hasLinkedAccount}
                diameter="var(--chat-avatar-sender)"
                enableZoom={false}
              />
              <span className={styles.memberRowText}>
                <span className={styles.memberFirst}>{dmOther.displayName}</span>
              </span>
              <RoleBadge role={dmOther.role} size="sm" iconOnly />
            </button>
          </section>
        ) : null}
      </div>

      {renameOpen ? (
        <div
          ref={renameDialogRef}
          className={styles.renameOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${renameFieldId}-title`}
        >
          <form className={styles.renameCard} onSubmit={handleRenameSubmit}>
            <h4 id={`${renameFieldId}-title`} className={styles.renameTitle}>
              {chatCopy.renameDialogTitle}
            </h4>
            <label htmlFor={renameFieldId} className={styles.renameLabel}>
              {chatCopy.renameInputLabel}
            </label>
            <input
              id={renameFieldId}
              className={styles.renameInput}
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              autoFocus
              maxLength={80}
              aria-invalid={Boolean(renameError) || undefined}
              aria-describedby={
                renameError ? `${renameFieldId}-error` : undefined
              }
            />
            {renameError ? (
              <p
                id={`${renameFieldId}-error`}
                className={styles.renameError}
                role="alert"
              >
                {renameError}
              </p>
            ) : null}
            <div className={styles.renameActions}>
              <button
                type="button"
                className={styles.renameCancel}
                onClick={() => setRenameOpen(false)}
              >
                {chatCopy.cancel}
              </button>
              <button
                type="submit"
                className={styles.renameSubmit}
                disabled={renameBusy || !renameDraft.trim()}
              >
                {chatCopy.save}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </aside>
  );
}
