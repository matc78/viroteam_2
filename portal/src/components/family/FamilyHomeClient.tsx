"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FamilyAudienceSwitcher } from "@/components/family/FamilyAudienceSwitcher";
import { useFamilyAudience } from "@/components/family/FamilyAudienceProvider";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import homeStyles from "@/app/(dashboard)/home/page.module.css";
import {
  readableTextOnBrand,
  splitBrandColorHex,
} from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import {
  loadAnnouncementsForGuardian,
  loadAnnouncementsForMember,
  type ClubAnnouncementRecord,
} from "@/lib/firebase/announcementService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberFeeStatuses } from "@/lib/firebase/constants";
import {
  HOME_PREVIEW_EVENT_LIMIT,
  loadTeamsByIds,
  loadTeamsForClub,
  loadUpcomingEvents,
  loadUpcomingEventsForGuardian,
  type ClubEventView,
} from "@/lib/firebase/eventService";
import {
  getActiveSeason,
  getMemberFee,
  isDeadlineToday,
  remainingCents,
  type FeeSeasonRecord,
  type MemberFeeRecord,
} from "@/lib/firebase/feeService";
import { getClubMember } from "@/lib/firebase/memberService";
import { feeStatusLabel } from "@/lib/members/membersView";
import styles from "./FamilyHomeClient.module.css";

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatEventWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function eventForMember(event: ClubEventView, memberId: string): boolean {
  if (event.teamMemberIds.length === 0) return false;
  return event.teamMemberIds.includes(memberId);
}

/** Vue parent : événement convoquant l’enfant ou visant l’une de ses équipes. */
function eventForChild(
  event: ClubEventView,
  memberId: string,
  childTeamIds: string[],
): boolean {
  if (event.teamMemberIds.includes(memberId)) return true;
  return event.teamIds.some((teamId) => childTeamIds.includes(teamId));
}

type FamilyHomeData = {
  memberDisplayName: string;
  memberFirstName: string;
  nextEvent: ClubEventView | null;
  upcoming: ClubEventView[];
  fee: MemberFeeRecord | null;
  season: FeeSeasonRecord | null;
  remaining: number;
  announcements: Array<{
    id: string;
    author: string;
    message: string;
  }>;
};

/** Accueil famille : chips + couleur club, nom enfant mis en avant. */
export function FamilyHomeClient() {
  const { activeClub, profile } = useAuth();
  const { selectedMemberId, selectedTarget, loading: audienceLoading } =
    useFamilyAudience();

  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    async (club) => {
      if (!selectedMemberId) {
        return {
          memberDisplayName: "l’enfant",
          memberFirstName: "l’enfant",
          nextEvent: null,
          upcoming: [],
          fee: null,
          season: null,
          remaining: 0,
          announcements: [],
        } satisfies FamilyHomeData;
      }

      const isGuardianView = selectedTarget?.kind === "child";

      let filtered: ClubEventView[];
      let announcements: ClubAnnouncementRecord[];
      let member: Awaited<ReturnType<typeof getClubMember>>;
      let season: FeeSeasonRecord | null;

      if (isGuardianView) {
        [member, season] = await Promise.all([
          getClubMember(club.id, selectedMemberId),
          getActiveSeason(club.id),
        ]);
        const childTeamIds = member?.teamIds ?? [];
        const teams = await loadTeamsByIds(club.id, childTeamIds);
        const events = await loadUpcomingEventsForGuardian(
          club.id,
          childTeamIds,
          { limit: 20, teams },
        );
        filtered = events.filter((event) =>
          eventForChild(event, selectedMemberId, childTeamIds),
        );
        announcements = member
          ? await loadAnnouncementsForGuardian({
              clubId: club.id,
              member,
              childTeamIds,
              teamCategoryById: new Map(
                teams.map((team) => [team.id, team.category]),
              ),
            })
          : [];
      } else {
        let events: ClubEventView[];
        let teams: Awaited<ReturnType<typeof loadTeamsForClub>>;
        [member, events, teams, season] = await Promise.all([
          getClubMember(club.id, selectedMemberId),
          loadUpcomingEvents(club.id, { limit: 20 }),
          loadTeamsForClub(club.id),
          getActiveSeason(club.id),
        ]);
        filtered = events.filter((event) =>
          eventForMember(event, selectedMemberId),
        );
        const teamCategoryById = new Map(
          teams.map((team) => [team.id, team.category]),
        );
        announcements = member
          ? await loadAnnouncementsForMember({
              clubId: club.id,
              member,
              teamCategoryById,
            })
          : [];
      }

      let fee: MemberFeeRecord | null = null;
      let remaining = 0;
      if (season) {
        fee = await getMemberFee(club.id, season.id, selectedMemberId);
        if (fee) remaining = remainingCents(fee, season);
      }

      const isSelf = selectedTarget?.kind === "self";
      const memberDisplayName = isSelf
        ? profile?.displayName ||
          [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
          "toi"
        : member?.displayName ||
          selectedTarget?.displayName ||
          [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
          "l’enfant";
      const memberFirstName = isSelf
        ? profile?.firstName || "toi"
        : member?.firstName ||
          selectedTarget?.label ||
          memberDisplayName.split(" ")[0] ||
          "l’enfant";

      return {
        memberDisplayName,
        memberFirstName,
        nextEvent: filtered[0] ?? null,
        upcoming: filtered.slice(0, HOME_PREVIEW_EVENT_LIMIT),
        fee,
        season,
        remaining,
        announcements: announcements.map((item) => ({
          id: item.id,
          author: [item.senderFirstName, item.senderLastName]
            .filter(Boolean)
            .join(" "),
          message: item.message,
        })),
      } satisfies FamilyHomeData;
    },
    [
      selectedMemberId,
      selectedTarget?.label,
      selectedTarget?.displayName,
      selectedTarget?.kind,
      profile?.firstName,
      profile?.lastName,
      profile?.displayName,
    ],
  );

  const brandStyle = useMemo(() => {
    const brand = splitBrandColorHex(
      activeClub?.brandColorHex ?? ClubSetupDefaults.brandColorHex,
    );
    const brandPrimary = brand.primary;
    const brandAlt = brand.secondary ?? brand.primary;
    return {
      "--club-brand": brandPrimary,
      "--club-brand-alt": brandAlt,
      "--club-brand-text": readableTextOnBrand(brandPrimary),
      "--club-brand-alt-text": readableTextOnBrand(brandAlt),
    } as CSSProperties;
  }, [activeClub?.brandColorHex]);

  if ((loading || audienceLoading) && !data) {
    return <DashboardSkeleton variant="home" />;
  }

  const feeDue =
    data?.fee &&
    data.season &&
    (data.fee.status === MemberFeeStatuses.aPayer ||
      data.fee.status === MemberFeeStatuses.partiel) &&
    data.remaining > 0;
  const feeDeadlineToday =
    feeDue &&
    data?.season?.paymentDeadlineAt != null &&
    isDeadlineToday(data.season.paymentDeadlineAt);
  const feeStatus = data?.fee?.status ?? null;
  const announcementCount = data?.announcements.length ?? 0;
  const eventCount = data?.upcoming.length ?? 0;
  const isSelf = selectedTarget?.kind === "self";
  const focusName =
    data?.memberDisplayName ||
    selectedTarget?.displayName ||
    (isSelf ? "toi" : "l’enfant");

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow={isSelf ? "Mon espace" : "Espace famille"}
        heading={focusName}
        lead={
          isSelf
            ? `Planning, convocations et cotisation — ${activeClub?.name ?? "ton club"}.`
            : `Suivi parent · planning, convocations et cotisation — ${activeClub?.name ?? "le club"}.`
        }
        onRefresh={reload}
        refreshing={refreshing}
      />
      <FamilyAudienceSwitcher />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className={homeStyles.playerStack} style={brandStyle}>
          <div className={homeStyles.summaryChips} aria-label="Résumé">
            <span className={styles.childChip} title={focusName}>
              <span className={homeStyles.summaryChipLabel}>
                {isSelf ? "Compte" : "Enfant"}
              </span>
              <span className={styles.childChipValue}>{focusName}</span>
            </span>
            <span
              className={`${homeStyles.summaryChip} ${
                feeDeadlineToday
                  ? homeStyles.summaryChipDeadline
                  : feeDue
                    ? homeStyles.summaryChipAlert
                    : homeStyles.summaryChipOk
              }`}
            >
              <span className={homeStyles.summaryChipLabel}>Cotisation</span>
              <span className={homeStyles.summaryChipValue}>
                {feeDue
                  ? formatEuros(data.remaining)
                  : feeStatus
                    ? feeStatusLabel(feeStatus)
                    : "—"}
              </span>
            </span>
            <span className={homeStyles.summaryChip}>
              <span className={homeStyles.summaryChipLabel}>Annonces</span>
              <span className={homeStyles.summaryChipValue}>
                {announcementCount}
              </span>
            </span>
            <span
              className={`${homeStyles.summaryChip} ${homeStyles.summaryChipAlt}`}
            >
              <span className={homeStyles.summaryChipLabel}>Événements</span>
              <span className={homeStyles.summaryChipValue}>{eventCount}</span>
            </span>
          </div>

          {feeDue ? (
            <section
              className={`${panelStyles.panel} ${homeStyles.playerPanel}${feeDeadlineToday ? ` ${homeStyles.playerPanelDeadline}` : ""}`}
              data-tone="brand"
              aria-label="Cotisation"
            >
              <header className={homeStyles.playerPanelHeader}>
                <h2 className={homeStyles.sectionTitle}>Cotisation</h2>
                <span
                  className={`${homeStyles.statusChip} ${
                    feeDeadlineToday
                      ? homeStyles.statusChipDeadline
                      : homeStyles.statusChipWarn
                  }`}
                >
                  {feeDeadlineToday
                    ? "Échéance aujourd'hui"
                    : feeStatusLabel(feeStatus)}
                </span>
              </header>
              <p className={homeStyles.feeAmount}>
                {formatEuros(data.remaining)}
              </p>
              <p className={homeStyles.feeHint}>
                {feeDeadlineToday
                  ? isSelf
                    ? "Dernier jour pour régler votre cotisation"
                    : `Dernier jour pour régler la cotisation de ${data.memberFirstName}`
                  : isSelf
                    ? "Reste à régler pour la saison en cours"
                    : `Reste à régler pour ${data.memberFirstName}`}
              </p>
              <Link href="/family/fees" className={homeStyles.feeBannerLink}>
                Voir la cotisation →
              </Link>
            </section>
          ) : null}

          <section
            className={`${panelStyles.panel} ${homeStyles.playerPanel}`}
            data-tone="brand"
            aria-labelledby="family-announcements-title"
          >
            <header className={homeStyles.playerPanelHeader}>
              <h2
                id="family-announcements-title"
                className={homeStyles.sectionTitle}
              >
                Annonces
              </h2>
              <span className={homeStyles.countChip}>{announcementCount}</span>
            </header>
            {announcementCount === 0 ? (
              <p className={homeStyles.emptyHint}>Aucune annonce en cours.</p>
            ) : (
              <ul className={homeStyles.announcementChipList}>
                {data.announcements.map((item) => (
                  <li key={item.id} className={homeStyles.announcementChip}>
                    <p className={homeStyles.announcementMessage}>
                      {item.message}
                    </p>
                    <span className={homeStyles.metaChip}>
                      {item.author || "Club"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className={`${panelStyles.panel} ${homeStyles.playerPanel}`}
            data-tone="brand-alt"
            aria-labelledby="family-events-title"
          >
            <header className={homeStyles.playerPanelHeader}>
              <h2 id="family-events-title" className={homeStyles.sectionTitle}>
                Prochains événements
              </h2>
              <div className={homeStyles.playerPanelActions}>
                <span
                  className={`${homeStyles.countChip} ${homeStyles.countChipAlt}`}
                >
                  {eventCount}
                </span>
                <Link
                  href="/family/planning"
                  className={homeStyles.viewAllInline}
                >
                  Planning →
                </Link>
              </div>
            </header>
            {eventCount === 0 ? (
              <p className={homeStyles.emptyHint}>
                Aucun événement à venir pour cette fiche.
              </p>
            ) : (
              <ul className={homeStyles.eventChipList}>
                {data.upcoming.map((event) => (
                  <li key={event.id} className={homeStyles.eventChip}>
                    <span className={homeStyles.eventWhenChip}>
                      {formatEventWhen(event.startsAt)}
                    </span>
                    <div className={homeStyles.eventChipBody}>
                      <p className={homeStyles.weekTitle}>{event.title}</p>
                      {event.location ? (
                        <p className={homeStyles.weekMeta}>{event.location}</p>
                      ) : null}
                      {activeClub && selectedMemberId ? (
                        <FamilyRsvpButtons
                          clubId={activeClub.id}
                          event={event}
                          memberId={selectedMemberId}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
