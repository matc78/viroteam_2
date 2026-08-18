"use client";

import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { PlanningEventTile } from "@/components/dashboard/PlanningEventTile";
import { FamilyAudienceSwitcher } from "@/components/family/FamilyAudienceSwitcher";
import { useFamilyAudience } from "@/components/family/FamilyAudienceProvider";
import { FamilyRsvpButtons } from "@/components/family/FamilyRsvpButtons";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  loadUpcomingEvents,
  type ClubEventView,
} from "@/lib/firebase/eventService";
import styles from "./FamilyHomeClient.module.css";

function eventForMember(event: ClubEventView, memberId: string): boolean {
  if (event.teamMemberIds.length === 0) return false;
  return event.teamMemberIds.includes(memberId);
}

/** Planning famille filtré sur la fiche cible + RSVP. */
export function FamilyPlanningClient() {
  const { activeClub } = useAuth();
  const { selectedMemberId, selectedTarget, loading: audienceLoading } =
    useFamilyAudience();

  const { data, loading, refreshing, error } = useAsyncClubResource(
    activeClub,
    async (club) => {
      if (!selectedMemberId) return [] as ClubEventView[];
      const events = await loadUpcomingEvents(club.id, { limit: 50 });
      return events.filter((event) => eventForMember(event, selectedMemberId));
    },
    [selectedMemberId],
  );

  if ((loading || audienceLoading) && !data) {
    return <DashboardSkeleton variant="planning" />;
  }

  const whose =
    selectedTarget?.kind === "self"
      ? "toi"
      : selectedTarget?.label || "l’enfant";

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace famille"
        heading="Planning"
        lead={`Les convocations de ${whose} — sans fusionner les calendriers.`}
      />
      <FamilyAudienceSwitcher />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {!data || data.length === 0 ? (
        <section className={panelStyles.panel} data-tone="cyan">
          <p className={styles.empty}>Aucun événement à venir pour cette fiche.</p>
        </section>
      ) : (
        <ul className={styles.announcements}>
          {data.map((event) => (
            <li key={event.id}>
              <section className={panelStyles.panel} data-tone="cyan">
                <PlanningEventTile event={event} />
                {activeClub && selectedMemberId ? (
                  <FamilyRsvpButtons
                    clubId={activeClub.id}
                    event={event}
                    memberId={selectedMemberId}
                  />
                ) : null}
              </section>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
