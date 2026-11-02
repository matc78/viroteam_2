"use client";

import { firstNameOf } from "@/components/home/homeFormat";
import { MemberHome } from "@/components/home/MemberHome";
import { PageHeader } from "@/components/ui/PageHeader";
import type { PlayerHomeDashboardData } from "@/lib/firebase/homeService";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import homeStyles from "@/components/home/home.module.css";

/** Accueil joueur : prochain rendez-vous, réponses, cotisation, annonces. */
export function PlayerHomeView({
  clubId,
  viewerUid,
  data,
  refreshing,
  error,
  reload,
}: {
  clubId: string;
  viewerUid: string | null;
  data: PlayerHomeDashboardData | null;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}) {
  if (!data) {
    return (
      <>
        <PageHeader title="Accueil" />
        {error ? (
          <p className={homeStyles.error} role="alert">
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <MemberHome
        eyebrow={data.clubName}
        title={`Bonjour ${firstNameOf(data.displayName)}`}
        error={error}
        events={data.upcomingEvents}
        planningHref="/planning"
        feesHref="/fees"
        rsvp={
          data.linkedMemberId
            ? {
                clubId,
                memberId: data.linkedMemberId,
                audienceIds: [
                  data.linkedMemberId,
                  ...(viewerUid ? [viewerUid] : []),
                ],
                onUpdated: reload,
              }
            : null
        }
        answerPrompt="Tu viens ?"
        emptyEventsText="Aucun événement à venir pour toi. Profite du repos."
        fee={data.fee}
        season={data.season}
        remainingCents={data.remainingCents}
        childFirstName={null}
        announcements={data.announcements.map((item) => ({
          id: item.id,
          message: item.message,
          author: item.senderName,
          createdAt: item.createdAt,
        }))}
      />
    </div>
  );
}
