"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
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
  chatDisplayTitle,
  isGroupConversation,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";
import styles from "./ConversationInfoPanel.module.css";

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
  initialRenameOpen = false,
}: ConversationInfoPanelProps) {
  const isGroup = isGroupConversation(conversation);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(initialRenameOpen);
  const [renameDraft, setRenameDraft] = useState(chatDisplayTitle(conversation));
  const [renameBusy, setRenameBusy] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);

  const brand = splitBrandColorHex(
    clubColor ?? ClubSetupDefaults.brandColorHex,
  ).primary;
  const brandText = readableTextOnBrand(brand);
  const title = chatDisplayTitle(conversation);
  const media = useMemo(
    () => extractConversationMedia(messages),
    [messages],
  );
  const mediaCount = media.images.length + media.links.length;
  const memberCount = participants.length;
  const memberLabel = `${memberCount} membre${memberCount > 1 ? "s" : ""}`;

  const selected = selectedUid
    ? participants.find((participant) => participant.uid === selectedUid) ??
      null
    : null;

  const dmOther =
    !isGroup && participants.length > 0
      ? participants[0] ?? null
      : null;

  async function handleRenameSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = renameDraft.trim();
    if (!trimmed || renameBusy) return;
    setRenameBusy(true);
    try {
      await onRename(trimmed);
      setRenameOpen(false);
    } finally {
      setRenameBusy(false);
    }
  }

  function openRename() {
    setRenameDraft(title);
    setRenameOpen(true);
  }

  if (selected) {
    return (
      <aside className={styles.panel} aria-label="Fiche membre">
        <header className={styles.header}>
          <button
            type="button"
            className={styles.headerIconBtn}
            aria-label="Retour"
            onClick={() => setSelectedUid(null)}
          >
            <ChatIcon name="close" size={20} />
          </button>
          <h2 className={styles.headerTitle}>Infos du contact</h2>
        </header>
        <div className={styles.memberDetail}>
          <MemberAvatar
            displayName={selected.displayName}
            avatarUrl={selected.avatarUrl}
            hasLinkedAccount={selected.hasLinkedAccount}
            size="md"
          />
          <h3 className={styles.memberName}>{selected.displayName}</h3>
          <RoleBadge role={selected.role} size="sm" />
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel} aria-label="Infos de la discussion">
      <header className={styles.header}>
        <button
          type="button"
          className={styles.headerIconBtn}
          aria-label="Fermer"
          onClick={onClose}
        >
          <ChatIcon name="close" size={20} />
        </button>
        <h2 className={styles.headerTitle}>
          {isGroup ? "Infos du groupe" : "Infos"}
        </h2>
      </header>

      <div className={styles.scrollBody}>
        <div className={styles.hero}>
          <span
            className={styles.heroAvatar}
            style={
              {
                background: `color-mix(in srgb, ${brand} 28%, white)`,
                color: brand,
              } as CSSProperties
            }
            aria-hidden
          >
            {title.trim().slice(0, 1).toUpperCase() || "?"}
          </span>

          <div className={styles.heroTitleRow}>
            <h3 className={styles.heroTitle}>{title}</h3>
            {isGroup ? (
              <button
                type="button"
                className={styles.editNameBtn}
                aria-label="Renommer"
                onClick={openRename}
              >
                <ChatIcon name="edit" size={18} />
              </button>
            ) : null}
          </div>

          <p className={styles.heroMeta}>
            {isGroup ? (
              <>
                Groupe ·{" "}
                <span className={styles.heroMetaAccent} style={{ color: brand }}>
                  {memberLabel}
                </span>
              </>
            ) : (
              "Discussion"
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
            Rechercher
          </button>
          <button
            type="button"
            className={styles.quickBtn}
            onClick={onToggleMute}
          >
            <span className={styles.quickIcon}>
              <ChatIcon name={muted ? "bell" : "mute"} size={22} />
            </span>
            {muted ? "Notifs" : "Mute"}
          </button>
          <button
            type="button"
            className={styles.quickBtn}
            onClick={onToggleFavorite}
          >
            <span className={styles.quickIcon}>
              <ChatIcon
                name={favorite ? "favoriteFill" : "favorite"}
                size={22}
              />
            </span>
            Favoris
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
              <span className={styles.listLabel}>Médias, liens et documents</span>
            </span>
            <span className={styles.listMeta}>{mediaCount}</span>
          </button>

          {mediaOpen ? (
            <div className={styles.mediaExpand}>
              {mediaCount === 0 ? (
                <p className={styles.empty}>Aucun média pour l’instant.</p>
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
                          <img src={image.url} alt="Photo partagée" />
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
              <span className={styles.listLabel}>Messages importants</span>
              <span className={styles.listHint}>
                {favorite ? "Dans les favoris" : "Pas encore en favori"}
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
              <span className={styles.listLabel}>Paramètres de notification</span>
              <span className={styles.listHint}>
                {muted ? "Notifications coupées" : "Toutes les notifications"}
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
                aria-label="Rechercher dans la discussion"
                onClick={onSearch}
              >
                <ChatIcon name="search" size={18} />
              </button>
            </div>
            {participantsLoading ? (
              <p className={styles.emptyPad}>Chargement des membres…</p>
            ) : participants.length === 0 ? (
              <p className={styles.emptyPad}>Aucun membre résolu.</p>
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
                        size="sm"
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
              <h4 className={styles.membersTitle}>Contact</h4>
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
                size="sm"
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
        <div className={styles.renameOverlay} role="dialog" aria-modal>
          <form className={styles.renameCard} onSubmit={handleRenameSubmit}>
            <h4 className={styles.renameTitle}>Renommer la discussion</h4>
            <input
              className={styles.renameInput}
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              autoFocus
              maxLength={80}
            />
            <div className={styles.renameActions}>
              <button
                type="button"
                className={styles.renameCancel}
                onClick={() => setRenameOpen(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className={styles.renameSubmit}
                disabled={renameBusy || !renameDraft.trim()}
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </aside>
  );
}
