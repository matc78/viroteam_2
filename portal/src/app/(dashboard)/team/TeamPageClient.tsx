"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { TeamsPanel } from "@/components/dashboard/TeamsPanel";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import {
  membersVisibleToViewer,
  teamsVisibleToViewer,
} from "@/lib/auth/bureauPermissions";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberRoles } from "@/lib/firebase/constants";
import { getLinkedMemberId } from "@/lib/firebase/memberService";
import { loadMembersPageData } from "@/lib/members/membersView";

async function noopAsync(): Promise<void> {}

/** Page Équipe joueur : roster en lecture seule des équipes du viewer. */
export function TeamPageClient() {
  const { activeClub, activeClubRole, user } = useAuth();
  const [linkedMemberId, setLinkedMemberId] = useState<string | null>(null);

  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    (club) => loadMembersPageData(club, { role: activeClubRole }),
    [activeClubRole],
  );

  useEffect(() => {
    if (!activeClub || !user) {
      setLinkedMemberId(null);
      return;
    }
    void getLinkedMemberId(activeClub.id, user.uid).then(setLinkedMemberId);
  }, [activeClub, user]);

  const scopedTeams = useMemo(() => {
    if (!data) return [];
    return teamsVisibleToViewer({
      role: activeClubRole,
      uid: user?.uid ?? null,
      linkedMemberId,
      teams: data.teams,
    });
  }, [data, activeClubRole, user?.uid, linkedMemberId]);

  const scopedMembers = useMemo(() => {
    if (!data) return [];
    return membersVisibleToViewer({
      role: activeClubRole,
      uid: user?.uid ?? null,
      linkedMemberId,
      teams: data.teams,
      members: data.members,
    });
  }, [data, activeClubRole, user?.uid, linkedMemberId]);

  if (loading && !data) {
    return <DashboardSkeleton variant="members" />;
  }

  const isPlayerView = activeClubRole === MemberRoles.player;
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
