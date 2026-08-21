"use client";

import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { FamilyAudienceSwitcher } from "@/components/family/FamilyAudienceSwitcher";
import { useFamilyAudience } from "@/components/family/FamilyAudienceProvider";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import { PlanningEventTile } from "@/components/dashboard/PlanningEventTile";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { loadAnnouncementsForMember } from "@/lib/firebase/announcementService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberFeeStatuses } from "@/lib/firebase/constants";
import {
  HOME_PREVIEW_EVENT_LIMIT,
  loadTeamsForClub,
  loadUpcomingEvents,
  type ClubEventView,
} from "@/lib/firebase/eventService";
import {
  getActiveSeason,
  getMemberFee,
  remainingCents,
  type FeeSeasonRecord,
  type MemberFeeRecord,
} from "@/lib/firebase/feeService";
import { getClubMember } from "@/lib/firebase/memberService";
import { feeStatusLabel } from "@/lib/members/membersView";
import Link from "next/link";
import styles from "./FamilyHomeClient.module.css";

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function eventForMember(event: ClubEventView, memberId: string): boolean {
  if (event.teamMemberIds.length === 0) return false;
  return event.teamMemberIds.includes(memberId);
}

type FamilyHomeData = {
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

/** Accueil famille : prochain événement, RSVP, cotisation, annonces. */
export function FamilyHomeClient() {
  const { activeClub, profile } = useAuth();
  const { selectedMemberId, selectedTarget, loading: audienceLoading } =
    useFamilyAudience();

  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    async (club) => {
      if (!selectedMemberId) {
        return {
          memberFirstName: "l’enfant",
          nextEvent: null,
          upcoming: [],
          fee: null,
          season: null,
          remaining: 0,
          announcements: [],
        } satisfies FamilyHomeData;
      }

      const [member, events, teams, season] = await Promise.all([
        getClubMember(club.id, selectedMemberId),
        loadUpcomingEvents(club.id, { limit: 20 }),
        loadTeamsForClub(club.id),
        getActiveSeason(club.id),
      ]);

      const filtered = events.filter((event) =>
        eventForMember(event, selectedMemberId),
      );
      const teamCategoryById = new Map(
        teams.map((team) => [team.id, team.category]),
      );
      const announcements = member
        ? await loadAnnouncementsForMember({
            clubId: club.id,
            member,
            teamCategoryById,
          })
        : [];

      let fee: MemberFeeRecord | null = null;
      let remaining = 0;
      if (season) {
        fee = await getMemberFee(club.id, season.id, selectedMemberId);
        if (fee) remaining = remainingCents(fee, season);
      }

      const firstName =
        selectedTarget?.label === "Moi"
          ? profile?.firstName || "toi"
          : member?.firstName || selectedTarget?.label || "l’enfant";

      return {
        memberFirstName: firstName,
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
    [selectedMemberId, selectedTarget?.label, profile?.firstName],
  );

  if ((loading || audienceLoading) && !data) {
    return <DashboardSkeleton variant="home" />;
  }

  const feeDue =
    data?.fee &&
    data.season &&
    (data.fee.status === MemberFeeStatuses.aPayer ||
      data.fee.status === MemberFeeStatuses.partiel) &&
    data.remaining > 0;

  const headingName =
    selectedTarget?.kind === "self"
      ? profile?.firstName || "toi"
      : data?.memberFirstName || "l’enfant";

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace famille"
        heading={`Bonjour ${profile?.firstName || ""}`.trim()}
        lead={
          selectedTarget?.kind === "self"
            ? `Planning, convocations et cotisation pour toi.`
            : `Planning, convocations et cotisation pour ${headingName}.`
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
        <div className={styles.stack}>
          {feeDue ? (
            <section
              className={panelStyles.panel}
              data-tone="orange"
              aria-label="Cotisation"
            >
              <p className={styles.bannerTitle}>
                Cotisation {feeStatusLabel(data.fee?.status ?? null).toLowerCase()}
              </p>
              <p className={styles.bannerLead}>
                Reste dû : {formatEuros(data.remaining)}
                {selectedTarget?.kind === "child"
                  ? ` pour ${data.memberFirstName}`
                  : ""}
                .
              </p>
              <Link href="/family/fees" className={styles.bannerLink}>
                Voir la cotisation →
              </Link>
            </section>
          ) : null}

          {data.nextEvent ? (
            <section className={panelStyles.panel} data-tone="cyan">
              <p className={styles.bannerTitle}>Prochain événement</p>
              <PlanningEventTile event={data.nextEvent} compact />
              {activeClub ? (
                <FamilyRsvpButtons
                  clubId={activeClub.id}
                  event={data.nextEvent}
                  memberId={selectedMemberId ?? ""}
                />
              ) : null}
            </section>
          ) : (
            <section className={panelStyles.panel} data-tone="cyan">
              <p className={styles.bannerTitle}>Prochain événement</p>
              <p className={styles.empty}>Aucun événement à venir pour cette fiche.</p>
            </section>
          )}

          {data.announcements.length > 0 ? (
            <section className={panelStyles.panel} data-tone="blue">
              <p className={styles.bannerTitle}>Annonces</p>
              <ul className={styles.announcements}>
                {data.announcements.map((item) => (
                  <li key={item.id}>
                    <p className={styles.announcementAuthor}>
                      {item.author || "Club"}
                    </p>
                    <p className={styles.announcementBody}>{item.message}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <UpcomingEvents
            events={data.upcoming}
            planningHref="/family/planning"
          />
        </div>
      ) : null}
    </div>
  );
}
