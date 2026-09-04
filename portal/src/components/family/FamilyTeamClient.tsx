"use client";

import { useMemo } from "react";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { TeamsPanel } from "@/components/dashboard/TeamsPanel";
import { FamilyAudienceSwitcher } from "@/components/family/FamilyAudienceSwitcher";
import { useFamilyAudience } from "@/components/family/FamilyAudienceProvider";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { loadTeamsByIds } from "@/lib/firebase/eventService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  getClubMember,
  loadMembersByRosterIds,
} from "@/lib/firebase/memberService";
import {
  memberMatchIds,
  rosterContains,
} from "@/lib/teams/viewerTeamScope";

async function noopAsync(): Promise<void> {}

type FamilyTeamData = {
  teams: Awaited<ReturnType<typeof loadTeamsByIds>>;
  members: Awaited<ReturnType<typeof loadMembersByRosterIds>>;
};

/** Page Équipe espace famille : roster lecture seule (Moi / enfant). */
export function FamilyTeamClient() {
  const { activeClub, profile } = useAuth();
  const {
    selectedMemberId,
    selectedTarget,
    loading: audienceLoading,
  } = useFamilyAudience();

  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub && selectedMemberId ? activeClub : null,
    async (club): Promise<FamilyTeamData> => {
      if (!selectedMemberId) {
        return { teams: [], members: [] };
      }

      const member = await getClubMember(club.id, selectedMemberId);
      const childMatchIds = memberMatchIds({
        memberId: selectedMemberId,
        accountUid: member?.accountUid ?? null,
      });

      // Parent : uniquement teams ∈ parentTeamIds (règles). member.teamIds en secours.
      const candidateTeamIds = [
        ...new Set([
          ...(profile?.parentTeamIds ?? []),
          ...(member?.teamIds ?? []),
        ]),
      ];
      const loadedTeams = await loadTeamsByIds(club.id, candidateTeamIds);
      const teams =
        selectedTarget?.kind === "child"
          ? loadedTeams.filter((team) =>
              rosterContains(team.playerIds, childMatchIds),
            )
          : loadedTeams.filter(
              (team) =>
                rosterContains(team.playerIds, childMatchIds) ||
                rosterContains(team.coachIds, childMatchIds),
            );

      const rosterIds = new Set<string>();
      for (const team of teams) {
        for (const playerId of team.playerIds) {
          if (playerId) rosterIds.add(playerId);
        }
        for (const coachId of team.coachIds) {
          if (coachId) rosterIds.add(coachId);
        }
      }
      rosterIds.add(selectedMemberId);
      if (member?.accountUid) rosterIds.add(member.accountUid);

      const members = await loadMembersByRosterIds(club.id, [...rosterIds]);
      return { teams, members };
    },
    [
      selectedMemberId,
      selectedTarget?.kind,
      profile?.parentTeamIds,
      profile?.uid,
    ],
  );

  const headingName = useMemo(() => {
    if (selectedTarget?.kind === "self") {
      return profile?.firstName || "toi";
    }
    return selectedTarget?.label || "l’enfant";
  }, [profile?.firstName, selectedTarget]);

  if ((loading || audienceLoading) && !data) {
    return <DashboardSkeleton variant="members" />;
  }

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace famille"
        heading="Équipe"
        lead={
          selectedTarget?.kind === "self"
            ? `Coéquipiers et encadrement pour toi.`
            : `Coéquipiers et encadrement pour ${headingName}.`
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

      {data && activeClub ? (
        <TeamsPanel
          clubId={activeClub.id}
          teams={data.teams}
          members={data.members}
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
