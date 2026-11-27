import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/members/utils/member_team_labels.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';
import 'package:viro_team_v2/utils/viro_debug_log.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Présences d'un club sur une période.
typedef ClubAttendanceRef = ({String clubId, AttendancePeriod period});

/// Présences d'une équipe sur une période.
typedef ClubAttendanceTeamRef = ({
  String clubId,
  AttendancePeriod period,
  String teamId,
});

/// Page Présences : bilan global et une ligne par équipe visible.
typedef ClubAttendanceView = ({
  AttendanceSummary summary,
  List<TeamAttendance> teams,
});

/// Présences de la page club : toutes les équipes pour le staff
/// ([ClubAccess.seesWholeClub]), ses équipes pour un coach ; mêmes calculs
/// que la page Présences du portail. Équipes rangées par catégorie puis nom.
final clubAttendanceProvider = FutureProvider.autoDispose
    .family<ClubAttendanceView, ClubAttendanceRef>((ref, target) async {
      final access = ref.watch(clubAccessProvider(target.clubId));
      final auth = ref.watch(firestoreAuthReadyProvider).value;
      final empty = (
        summary: summarizeAttendance(
          teams: const [],
          events: const [],
          now: DateTime.now(),
        ),
        teams: const <TeamAttendance>[],
      );
      if (auth == null || !access.canViewAttendance) return empty;
      final allTeams = await ref.watch(clubTeamsProvider(target.clubId).future);
      final teams = [
        for (final team in allTeams)
          if (access.seesWholeClub || access.coachesTeam(team.id)) team,
      ]..sort(_byCategoryThenName);
      if (teams.isEmpty) return empty;

      final now = DateTime.now();
      final since = attendancePeriodStart(target.period, now);
      final service = ref.watch(attendanceServiceProvider);
      final events = access.seesWholeClub
          ? await service.loadClubEvents(clubId: target.clubId, since: since)
          : await service.loadTeamEvents(
              clubId: target.clubId,
              teamIds: [for (final team in teams) team.id],
              since: since,
            );
      final members = await ref.watch(
        clubMembersProvider(target.clubId).future,
      );
      final names = {
        for (final member in members) member.memberId: member.fullName,
      };
      return (
        summary: summarizeAttendance(teams: teams, events: events, now: now),
        teams: [
          for (final team in teams)
            computeTeamAttendance(
              team: team,
              events: events,
              names: names,
              now: now,
              playerFallbackName: AppCopy.attendance.playerFallback,
              coachFallbackName: AppCopy.attendance.coachFallback,
            ),
        ],
      );
    });

/// Présences d'une équipe (détail), `null` si l'équipe n'est pas visible.
final clubAttendanceTeamProvider = Provider.autoDispose
    .family<AsyncValue<TeamAttendance?>, ClubAttendanceTeamRef>((ref, target) {
      return ref
          .watch(
            clubAttendanceProvider((
              clubId: target.clubId,
              period: target.period,
            )),
          )
          .whenData(
            (view) => view.teams
                .where((row) => row.team.id == target.teamId)
                .firstOrNull,
          );
    });

/// Fiche membre d'un club.
typedef MemberAttendanceRef = ({String clubId, String memberId});

/// Ligne de présence fiche membre : bilan + badges roster dans l'équipe.
typedef MemberSeasonAttendanceRow = ({
  TeamAttendance attendance,
  List<ViroRole> roles,
});

/// Présences de saison pour la fiche : [onRoster] si joueur ou coach d'au
/// moins une équipe visible ; [rows] une entrée par équipe avec au moins une
/// convocation **passée** depuis le 1er août.
typedef MemberSeasonAttendanceView = ({
  bool onRoster,
  List<MemberSeasonAttendanceRow> rows,
});

/// Présences de saison d'un membre (joueur ou coach). Visible par tous ;
/// un parent ne voit que les équipes de ses enfants (`clubTeamsProvider`).
/// Lecture via `loadTeamEvents` (forme autorisée aussi aux parents).
final memberSeasonAttendanceProvider = FutureProvider.autoDispose
    .family<MemberSeasonAttendanceView, MemberAttendanceRef>((
      ref,
      target,
    ) async {
      const empty = (onRoster: false, rows: <MemberSeasonAttendanceRow>[]);
      if (ref.watch(firestoreAuthReadyProvider).value == null) return empty;
      try {
        final teams = await ref.watch(clubTeamsProvider(target.clubId).future);
        final memberTeams = [
          for (final team in teams)
            if (team.playerIds.contains(target.memberId) ||
                team.coachIds.contains(target.memberId))
              team,
        ]..sort(_byCategoryThenName);
        if (memberTeams.isEmpty) return empty;

        final now = DateTime.now();
        final events = await ref
            .watch(attendanceServiceProvider)
            .loadTeamEvents(
              clubId: target.clubId,
              teamIds: [for (final team in memberTeams) team.id],
              since: attendancePeriodStart(AttendancePeriod.season, now),
            );
        return (
          onRoster: true,
          rows: [
            for (final team in memberTeams)
              if (computeMemberTeamAttendance(
                    team: team,
                    memberId: target.memberId,
                    events: events,
                    now: now,
                  )
                  case final attendance?)
                (
                  attendance: attendance,
                  roles: resolveMemberTeamRoles(team, target.memberId),
                ),
          ],
        );
      } catch (error, stackTrace) {
        ViroDebugLog.error(
          'memberSeasonAttendanceProvider '
          '(${target.clubId}/${target.memberId}): $error',
          stackTrace,
        );
        rethrow;
      }
    });

int _byCategoryThenName(ClubTeam a, ClubTeam b) {
  final byCategory = a.categoryLabel.compareTo(b.categoryLabel);
  return byCategory != 0
      ? byCategory
      : a.name.toLowerCase().compareTo(b.name.toLowerCase());
}
