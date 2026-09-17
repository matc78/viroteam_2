"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { AppleEmoji } from "@/components/chat/AppleEmoji";
import { AppleReactionPicker } from "@/components/chat/AppleReactionPicker";
import {
  computeAnchoredPopover,
  findScrollParent,
  type AnchoredPopoverLayout,
} from "@/components/chat/anchoredPopover";
import { QUICK_REACTIONS } from "@/components/chat/emojiCatalog";
import { MemberAvatar } from "@/components/dashboard/MemberAvatar";
import styles from "./MessageReactions.module.css";

/** Profil affiché dans le détail des réactions. */
export type ReactionPerson = {
  uid: string;
  label: string;
  displayName: string;
  avatarUrl: string | null;
  hasLinkedAccount: boolean;
};

type ReactionEntry = { emoji: string; uids: string[] };

function reactionEntries(
  reactions: Record<string, string[]>,
): ReactionEntry[] {
  return Object.entries(reactions)
    .filter(([, uids]) => uids.length > 0)
    .map(([emoji, uids]) => ({ emoji, uids }));
}

function totalReactionCount(entries: ReactionEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.uids.length, 0);
}

type MessageReactionsBarProps = {
  reactions: Record<string, string[]>;
  myUid: string | null | undefined;
  peopleByUid: Map<string, ReactionPerson>;
  onToggle: (emoji: string) => void;
  /** true = bulle à droite (aligne le popup sur le bord droit). */
  mine?: boolean;
};

/**
 * Pastilles style WhatsApp sous la bulle.
 * Clic → panneau « qui a réagi » ancré à la bulle.
 */
export function MessageReactionsBar({
  reactions,
  myUid,
  peopleByUid,
  onToggle,
  mine = false,
}: MessageReactionsBarProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const entries = useMemo(() => reactionEntries(reactions), [reactions]);

  if (entries.length === 0) return null;

  return (
    <>
      <div className={styles.bar} ref={barRef}>
        <button
          type="button"
          className={styles.chipGroup}
          aria-label={`${totalReactionCount(entries)} réaction${totalReactionCount(entries) > 1 ? "s" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            setDetailsOpen(true);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDetailsOpen(true);
          }}
        >
          {entries.map(({ emoji, uids }) => {
            const mineChip = Boolean(myUid && uids.includes(myUid));
            return (
              <span
                key={emoji}
                className={`${styles.chip}${mineChip ? ` ${styles.chipMine}` : ""}`}
              >
                <AppleEmoji emoji={emoji} size={16} />
                {uids.length > 1 ? (
                  <span className={styles.count}>{uids.length}</span>
                ) : null}
              </span>
            );
          })}
        </button>
      </div>
      {detailsOpen
        ? createPortal(
            <ReactionDetailsPanel
              reactions={reactions}
              myUid={myUid}
              peopleByUid={peopleByUid}
              onToggle={onToggle}
              onClose={() => setDetailsOpen(false)}
              anchorEl={barRef.current}
              alignEnd={mine}
            />,
            document.body,
          )
        : null}
    </>
  );
}

type ReactionQuickBarProps = {
  onPick: (emoji: string) => void;
};

/**
 * Barre réactions compacte Apple (PNG datasource) + « + » pour le catalogue.
 */
export function ReactionQuickBar({ onPick }: ReactionQuickBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className={styles.quickExpanded}>
        <AppleReactionPicker
          onPick={onPick}
          reactionsOpen={false}
        />
      </div>
    );
  }

  return (
    <div className={styles.quickBar} role="toolbar" aria-label="Réagir">
      {QUICK_REACTIONS.map(({ emoji, unified }) => (
        <button
          key={unified}
          type="button"
          className={styles.quickEmojiBtn}
          aria-label={emoji}
          onClick={() => onPick(emoji)}
        >
          <AppleEmoji emoji={unified} size={22} />
        </button>
      ))}
      <button
        type="button"
        className={styles.quickMoreBtn}
        aria-label="Plus d’émojis"
        onClick={() => setExpanded(true)}
      >
        <AppleEmoji emoji="1f642" size={18} />
        <span className={styles.quickMorePlus} aria-hidden>
          +
        </span>
      </button>
    </div>
  );
}

type ReactionDetailsPanelProps = {
  reactions: Record<string, string[]>;
  myUid: string | null | undefined;
  peopleByUid: Map<string, ReactionPerson>;
  onToggle: (emoji: string) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  alignEnd?: boolean;
};

const DETAILS_WIDTH = 300;

/**
 * Panneau détail ancré sous/au-dessus des chips (suit le scroll du fil).
 */
function ReactionDetailsPanel({
  reactions,
  myUid,
  peopleByUid,
  onToggle,
  onClose,
  anchorEl,
  alignEnd = false,
}: ReactionDetailsPanelProps) {
  const entries = useMemo(() => reactionEntries(reactions), [reactions]);
  const [filter, setFilter] = useState<string | "all">("all");
  const [picking, setPicking] = useState(false);
  const [layout, setLayout] = useState<AnchoredPopoverLayout | null>(null);
  const titleId = useId();
  const total = totalReactionCount(entries);

  const updateLayout = useCallback(() => {
    if (!anchorEl) {
      setLayout(null);
      return;
    }
    const scrollParent = findScrollParent(anchorEl);
    const viewportRect = scrollParent
      ? scrollParent.getBoundingClientRect()
      : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const next = computeAnchoredPopover({
      anchorRect: anchorEl.getBoundingClientRect(),
      viewportRect,
      popupWidth: DETAILS_WIDTH,
      estimatedHeight: picking ? 420 : 260,
      maxHeight: Math.min(360, viewportRect.height - 16),
      alignEnd,
    });
    setLayout(next);
  }, [anchorEl, alignEnd, picking]);

  useLayoutEffect(() => {
    updateLayout();
  }, [updateLayout]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateLayout);
    const scrollParent = anchorEl ? findScrollParent(anchorEl) : null;
    scrollParent?.addEventListener("scroll", updateLayout, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateLayout);
      scrollParent?.removeEventListener("scroll", updateLayout);
    };
  }, [anchorEl, onClose, updateLayout]);

  const rows = useMemo(() => {
    const list: { uid: string; emoji: string }[] = [];
    for (const entry of entries) {
      if (filter !== "all" && entry.emoji !== filter) continue;
      for (const uid of entry.uids) {
        list.push({ uid, emoji: entry.emoji });
      }
    }
    list.sort((a, b) => {
      const aMine = myUid && a.uid === myUid ? 0 : 1;
      const bMine = myUid && b.uid === myUid ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      const aName = peopleByUid.get(a.uid)?.label ?? "";
      const bName = peopleByUid.get(b.uid)?.label ?? "";
      return aName.localeCompare(bName, "fr", { sensitivity: "base" });
    });
    return list;
  }, [entries, filter, myUid, peopleByUid]);

  const cardStyle: CSSProperties | undefined = layout
    ? {
        left: layout.left,
        top: layout.top,
        width: layout.width,
        maxHeight: layout.maxHeight,
        transform:
          layout.placement === "above" ? "translateY(-100%)" : undefined,
      }
    : undefined;

  return (
    <div
      className={styles.detailsOverlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.detailsCard}
        style={cardStyle}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby={titleId}
      >
        <div className={styles.detailsTop}>
          <p id={titleId} className={styles.detailsTitle}>
            {total <= 1 ? "1 réaction" : `${total} réactions`}
          </p>
          <div className={styles.detailsFilters}>
            <button
              type="button"
              className={styles.addReactionBtn}
              aria-label="Ajouter une réaction"
              aria-expanded={picking}
              onClick={() => setPicking((open) => !open)}
            >
              <span className={styles.addReactionFace} aria-hidden>
                <AppleEmoji emoji="1f642" size={18} />
              </span>
              <span className={styles.addReactionPlus} aria-hidden>
                +
              </span>
            </button>
            {entries.map(({ emoji, uids }) => {
              const mineChip = Boolean(myUid && uids.includes(myUid));
              return (
              <button
                key={emoji}
                type="button"
                className={`${styles.filterChip}${filter === emoji ? ` ${styles.filterChipActive}` : ""}${mineChip ? ` ${styles.filterChipMine}` : ""}`}
                aria-pressed={filter === emoji}
                onClick={() =>
                  setFilter((current) => (current === emoji ? "all" : emoji))
                }
              >
                <AppleEmoji emoji={emoji} size={16} />
                <span>{uids.length}</span>
              </button>
              );
            })}
          </div>
          {picking ? (
            <div className={styles.detailsPicker}>
              <AppleReactionPicker
                onPick={(emoji) => {
                  onToggle(emoji);
                  setPicking(false);
                }}
                reactionsOpen={false}
              />
            </div>
          ) : null}
        </div>
        <ul className={styles.reactorList}>
          {rows.map(({ uid, emoji }) => {
            const person = peopleByUid.get(uid);
            const mine = Boolean(myUid && uid === myUid);
            const label = mine ? "Vous" : (person?.label ?? "Membre");
            const displayName = person?.displayName || label;
            return (
              <li key={`${uid}-${emoji}`}>
                <button
                  type="button"
                  className={styles.reactorRow}
                  disabled={!mine}
                  onClick={() => {
                    if (!mine) return;
                    onToggle(emoji);
                    onClose();
                  }}
                >
                  <MemberAvatar
                    displayName={displayName}
                    avatarUrl={person?.avatarUrl}
                    hasLinkedAccount={person?.hasLinkedAccount ?? false}
                    size="sm"
                    enableZoom={false}
                  />
                  <span className={styles.reactorText}>
                    <span className={styles.reactorName}>{label}</span>
                    {mine ? (
                      <span className={styles.reactorHint}>
                        Clique pour supprimer
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`${styles.reactorEmoji}${mine ? ` ${styles.reactorEmojiMine}` : ""}`}
                    aria-hidden
                  >
                    <AppleEmoji emoji={emoji} size={22} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
