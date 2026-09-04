"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ClubEventView,
  PlanningGuestDirectoryEntry,
  TeamOption,
} from "@/lib/firebase/eventService";
import {
  eventTypeLabel,
  formatDayHeading,
  formatEventTime,
} from "@/lib/firebase/eventService";
import {
  ANCHORED_POPOVER_FALLBACK_WIDTH_PX,
  computeAnchoredPosition,
  findEventBlockAnchor,
  type PopoverAnchorRect,
} from "@/lib/planning/anchoredPopoverPosition";
import { buildEventGuestRows } from "@/lib/planning/eventGuestRows";
import { colorForFilter } from "@/lib/planning/calendarColors";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import { MemberAvatar } from "@/components/dashboard/MemberAvatar";
import panelStyles from "./DashboardPanel.module.css";
import styles from "./PlanningEventDetailPanel.module.css";

type RsvpRowStatus = "yes" | "no" | "pending";
type RsvpValue = "yes" | "maybe" | "no";

/** Props du panneau détail événement. */
type PlanningEventDetailPanelProps = {
  event: ClubEventView;
  onClose: () => void;
  /** Ancrage viewport (bloc calendrier cliqué) ; sinon centrage / lookup DOM. */
  anchor?: PopoverAnchorRect | null;
  /** Couleur du bloc calendrier cliqué (pastille titre). */
  eventColor?: string | null;
  /** Équipes pour résoudre les coachs du roster. */
  teams?: TeamOption[];
  /** Annuaire noms / avatars indexé par memberId ou accountUid. */
  guestDirectory?: Record<string, PlanningGuestDirectoryEntry>;
  clubId?: string;
  /** Si fourni, affiche les boutons RSVP pour ce membre. */
  linkedMemberId?: string | null;
  onRsvpUpdated?: () => void;
};

function rsvpRowLabel(status: RsvpRowStatus): string {
  switch (status) {
    case "yes":
      return "Présent";
    case "no":
      return "Absent";
    default:
      return "En attente";
  }
}

function formatEventRange(event: ClubEventView): string {
  const dayLabel = formatDayHeading(new Date(event.startsAt));
  const start = formatEventTime(event.startsAt);
  const end = formatEventTime(event.endsAt);
  return `${dayLabel} · ${start} – ${end}`;
}

function resolveSwatchColor(
  event: ClubEventView,
  eventColor: string | null | undefined,
): string {
  const trimmed = eventColor?.trim();
  if (trimmed) return trimmed;
  const firstTeamId = event.teamIds[0];
  if (firstTeamId) return colorForFilter("team", firstTeamId);
  return "var(--tone-blue)";
}

/** Applique une réponse RSVP locale (optimistic UI) sur l'événement affiché. */
function withLocalRsvp(
  event: ClubEventView,
  memberId: string,
  value: RsvpValue,
  aliasIds: string[] = [],
): ClubEventView {
  const nextMap = { ...event.rsvpByMemberId };
  for (const id of [memberId, ...aliasIds]) {
    if (id) nextMap[id] = value;
  }
  const values = Object.values(nextMap).map((entry) => entry.toLowerCase());
  const rsvpYes = values.filter((entry) => entry === "yes").length;
  const rsvpNo = values.filter((entry) => entry === "no").length;
  const rsvpTotal =
    event.rsvpTotal > 0 ? event.rsvpTotal : event.teamMemberIds.length;
  const rsvpPending = Math.max(0, rsvpTotal - rsvpYes - rsvpNo);
  return {
    ...event,
    rsvpByMemberId: nextMap,
    rsvpYes,
    rsvpNo,
    rsvpPending,
    rsvpTotal,
  };
}

/** Détail lecture seule d'un événement avec stats et liste RSVP. */
export function PlanningEventDetailPanel({
  event,
  onClose,
  anchor = null,
  eventColor = null,
  teams = [],
  guestDirectory = {},
  clubId,
  linkedMemberId,
  onRsvpUpdated,
}: PlanningEventDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [resolvedAnchor, setResolvedAnchor] = useState<PopoverAnchorRect | null>(
    anchor,
  );
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    side: "left" | "right";
  } | null>(() => {
    if (typeof window === "undefined" || !anchor) return null;
    return computeAnchoredPosition(
      anchor,
      ANCHORED_POPOVER_FALLBACK_WIDTH_PX,
      420,
    );
  });
  const [localRsvp, setLocalRsvp] = useState<{
    memberId: string;
    value: RsvpValue;
  } | null>(null);

  const showRsvpFooter = Boolean(clubId && linkedMemberId);
  const swatchColor = resolveSwatchColor(event, eventColor);

  const linkedAliasIds = useMemo(() => {
    if (!linkedMemberId) return [] as string[];
    const entry = guestDirectory[linkedMemberId];
    if (!entry) return [linkedMemberId];
    return Object.entries(guestDirectory)
      .filter(([, other]) => other === entry)
      .map(([id]) => id);
  }, [guestDirectory, linkedMemberId]);

  useEffect(() => {
    setLocalRsvp(null);
  }, [event.id]);

  useEffect(() => {
    if (!localRsvp) return;
    const matched = linkedAliasIds.some(
      (id) =>
        (event.rsvpByMemberId[id] ?? "").toLowerCase() === localRsvp.value,
    );
    if (matched) setLocalRsvp(null);
  }, [event.rsvpByMemberId, localRsvp, linkedAliasIds]);

  const displayEvent = useMemo(() => {
    if (!localRsvp) return event;
    return withLocalRsvp(
      event,
      localRsvp.memberId,
      localRsvp.value,
      linkedAliasIds,
    );
  }, [event, localRsvp, linkedAliasIds]);

  const guestRows = useMemo(
    () =>
      buildEventGuestRows({
        event: displayEvent,
        teams,
        directory: guestDirectory,
      }),
    [displayEvent, teams, guestDirectory],
  );

  useLayoutEffect(() => {
    if (anchor) {
      setResolvedAnchor(anchor);
      return;
    }
    setResolvedAnchor(findEventBlockAnchor(event.id));
  }, [anchor, event.id]);

  useLayoutEffect(() => {
    function updatePosition() {
      if (!resolvedAnchor) {
        setPosition(null);
        return;
      }
      const panel = panelRef.current;
      const width = panel?.offsetWidth || ANCHORED_POPOVER_FALLBACK_WIDTH_PX;
      const height = panel?.offsetHeight || 420;
      setPosition(computeAnchoredPosition(resolvedAnchor, width, height));
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [resolvedAnchor, event.id, guestRows.length, showRsvpFooter]);

  const anchored = Boolean(resolvedAnchor && position);
  const guestSummary =
    displayEvent.rsvpTotal > 0
      ? `${displayEvent.rsvpTotal} convoqué${displayEvent.rsvpTotal > 1 ? "s" : ""} · ${displayEvent.rsvpYes} oui · ${displayEvent.rsvpNo} non · ${displayEvent.rsvpPending} en attente`
      : "Aucune convocation enregistrée";

  function handleRsvpUpdated(value: RsvpValue) {
    if (linkedMemberId) {
      setLocalRsvp({ memberId: linkedMemberId, value });
    }
    onRsvpUpdated?.();
  }

  return (
    <div
      className={styles.backdrop}
      data-anchored={anchored ? "true" : "false"}
      role="presentation"
      onClick={onClose}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`${panelStyles.panel} ${styles.panel}`}
        data-tone="cyan"
        data-side={position?.side ?? "center"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
        style={
          anchored && position
            ? { left: position.left, top: position.top }
            : undefined
        }
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={styles.header}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Fermer le détail"
          >
            ×
          </button>
          <div className={styles.titleRow}>
            <span
              className={styles.typeSwatch}
              style={{ background: swatchColor }}
              aria-hidden="true"
            />
            <div className={styles.titleBlock}>
              <p className={styles.eyebrow}>{eventTypeLabel(event.type)}</p>
              <h2 id="event-detail-title" className={styles.title}>
                {event.title}
              </h2>
              <p className={styles.when}>{formatEventRange(event)}</p>
            </div>
          </div>
        </header>

        <FadeScrollArea
          className={styles.bodyScroll}
          viewportClassName={styles.body}
        >
          {event.teamLabels.length > 0 ? (
            <div className={styles.metaRow}>
              <span className={styles.metaIcon} aria-hidden="true">
                <TeamIcon />
              </span>
              <div>
                <p className={styles.metaLabel}>Équipe(s)</p>
                <p className={styles.metaValue}>{event.teamLabels.join(", ")}</p>
              </div>
            </div>
          ) : null}

          {event.location ? (
            <div className={styles.metaRow}>
              <span className={styles.metaIcon} aria-hidden="true">
                <LocationIcon />
              </span>
              <div>
                <p className={styles.metaLabel}>Lieu</p>
                <p className={styles.metaValue}>{event.location}</p>
              </div>
            </div>
          ) : null}

          <section className={styles.guestsSection} aria-label="Réponses RSVP">
            <div className={styles.guestsHeader}>
              <span className={styles.metaIcon} aria-hidden="true">
                <GuestsIcon />
              </span>
              <p className={styles.guestsSummary}>{guestSummary}</p>
            </div>

            {guestRows.length > 0 ? (
              <ul className={styles.rsvpList}>
                {guestRows.map((row) => (
                  <li key={row.key} className={styles.rsvpRow}>
                    <span className={styles.avatarWrap}>
                      <MemberAvatar
                        displayName={row.name}
                        avatarUrl={row.avatarUrl}
                        hasLinkedAccount
                        size="xs"
                        tone="offwhite"
                      />
                      <span
                        className={styles.rsvpStatusBadge}
                        data-status={row.status}
                        title={rsvpRowLabel(row.status)}
                        aria-label={rsvpRowLabel(row.status)}
                      >
                        {row.status === "yes"
                          ? "✓"
                          : row.status === "no"
                            ? "×"
                            : "·"}
                      </span>
                    </span>
                    <div className={styles.rsvpIdentity}>
                      <span className={styles.rsvpName}>{row.name}</span>
                      {row.isCoach ? (
                        <span className={styles.rsvpRole}>Coach</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </FadeScrollArea>

        {showRsvpFooter && clubId && linkedMemberId ? (
          <footer className={styles.rsvpFooter}>
            <FamilyRsvpButtons
              clubId={clubId}
              event={displayEvent}
              memberId={linkedMemberId}
              audienceIds={linkedAliasIds}
              onUpdated={handleRsvpUpdated}
              variant="footer"
            />
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 256 256" width="18" height="18" fill="currentColor">
      <path d="M244.8 150.4a8 8 0 0 1-11.2-1.6A51.6 51.6 0 0 0 192 128a8 8 0 0 1 0-16 24 24 0 1 0-23.24-30 8 8 0 1 1-15.5-4A40 40 0 1 1 192 128a67.94 67.94 0 0 1 41.6 30.4 8 8 0 0 1-1.6 11.2ZM95.24 78a8 8 0 0 1-15.5 4A24 24 0 1 0 56 112a8 8 0 0 1 0 16 51.6 51.6 0 0 0-41.6 20.8 8 8 0 0 1-12.8-9.6A67.94 67.94 0 0 1 56 112a40 40 0 1 1 39.24-34ZM168 160a8 8 0 0 0-8-8H96a8 8 0 0 0-8 8 40 40 0 0 0 80 0Zm-16.1 16.4A24.06 24.06 0 0 1 128 192a24.06 24.06 0 0 1-23.9-15.6 56.27 56.27 0 0 1 47.8 0Z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 256 256" width="18" height="18" fill="currentColor">
      <path d="M128 16a88.1 88.1 0 0 0-88 88c0 75.3 80 132.17 83.41 134.55a8 8 0 0 0 9.18 0C136 236.17 216 179.3 216 104a88.1 88.1 0 0 0-88-88Zm0 56a32 32 0 1 1-32 32 32 32 0 0 1 32-32Z" />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg viewBox="0 0 256 256" width="18" height="18" fill="currentColor">
      <path d="M117.25 157.92a60 60 0 1 0-66.5 0 95.83 95.83 0 0 0-47.22 37.71 8 8 0 1 0 13.4 8.74 80 80 0 0 1 134.14 0 8 8 0 0 0 13.4-8.74 95.83 95.83 0 0 0-47.22-37.71ZM40 108a44 44 0 1 1 44 44 44.05 44.05 0 0 1-44-44Zm210.53 97.41a8 8 0 0 1-11.12 2.79A80 80 0 0 0 172 168a8 8 0 0 1 0-16 44 44 0 1 0-16.34-84.87 8 8 0 1 1-5.94-14.85 60 60 0 0 1 55.53 105.64 95.83 95.83 0 0 1 47.22 37.71 8 8 0 0 1-1.94 11.12Z" />
    </svg>
  );
}
