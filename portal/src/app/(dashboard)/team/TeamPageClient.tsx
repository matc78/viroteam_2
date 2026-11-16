"use client";

import { useBureauCapabilities } from "@/lib/auth/useBureauCapabilities";
import { useMemo } from "react";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { TeamsPanel } from "@/components/dashboard/TeamsPanel";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import {
  membersVisibleToViewer,
  teamsVisibleToViewer,
} from "@/lib/auth/bureauPermissions";
import { useAsyncClubPageResource } from "@/components/common/useAsyncClubPageResource";
import {
  ClubListenSets,
  useClubRealtimeReload,
  useIsPortalRouteActive,
} from "@/lib/dashboard/useClubRealtimeReload";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { loadMembersPageData } from "@/lib/members/membersView";

async function noopAsync(): Promise<void> {}

/** Page Équipe joueur : roster en lecture seule des équipes du viewer. */
export function TeamPageClient() {
  const { activeClub, user } = useAuth();
  const caps = useBureauCapabilities();
  const teamActive = useIsPortalRouteActive(["/team"]);

  const { data, loading, refreshing, error, reload } = useAsyncClubPageResource(
    activeClub,
    (club) =>
      loadMembersPageData(club, { rosterOnly: true }),
    [],
    "/team",
  );
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.team,
    onReload: reload,
    enabled: teamActive,
  });

  const scopedTeams = useMemo(() => {
    if (!data) return [];
    return teamsVisibleToViewer({
      caps,
      uid: user?.uid ?? null,
      teams: data.teams,
    });
  }, [data, caps, user?.uid]);

  const scopedMembers = useMemo(() => {
    if (!data) return [];
    return membersVisibleToViewer({
      caps,
      uid: user?.uid ?? null,
      teams: data.teams,
      members: data.members,
    });
  }, [data, caps, user?.uid]);

  if (loading && !data) {
    return <DashboardSkeleton variant="members" />;
  }

  const isPlayerView = !caps.isStaff;
  const introLead = isPlayerView
    ? `Coéquipiers et encadrement — ${activeClub?.name ?? "votre club"}.`
    : `Composition des équipes — ${activeClub?.name ?? "votre club"}.`;

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow={isPlayerView ? "Mon club" : "Espace club"}
        heading="Équipe"
        lead={introLead}
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {data && activeClub ? (
        <TeamsPanel
          clubId={activeClub.id}
          teams={scopedTeams}
          members={scopedMembers}
          sport={activeClub.sport}
          busy={false}
          error={null}
          viewerMemberId={user?.uid ?? null}
          canCreateTeam={false}
          canEditTeam={false}
          canDeleteTeam={false}
          canManageCoaches={false}
          canRemovePlayers={false}
          canAddPlayerToTeam={() => false}
          centered
          onCreateTeam={noopAsync}
          onUpdateTeam={async () => noopAsync()}
          onDeleteTeam={noopAsync}
          onAddMember={async () => noopAsync()}
          onRemoveMember={async () => noopAsync()}
        />
      ) : null}
    </div>
  );
}
