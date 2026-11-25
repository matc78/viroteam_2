import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/home/providers/home_teams_provider.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';

/// Équipe du club dont on lit les données fédérales.
typedef StandingsTeamRef = ({String clubId, String teamId});

/// Équipe de la poule dont on affiche la saison.
typedef PoolTeamRef = ({String clubId, String teamId, String poolTeamKey});

/// Classement de la poule liée à l'équipe (`null` avant la 1re synchro).
final teamStandingsProvider = StreamProvider.autoDispose
    .family<PoolStandings?, StandingsTeamRef>((ref, team) {
      return ref
          .watch(teamFederationServiceProvider)
          .watchStandings(clubId: team.clubId, teamId: team.teamId);
    });

/// Tous les matchs de la poule liée à l'équipe.
final poolMatchesProvider = StreamProvider.autoDispose
    .family<List<PoolMatch>, StandingsTeamRef>((ref, team) {
      return ref
          .watch(teamFederationServiceProvider)
          .watchPoolMatches(clubId: team.clubId, teamId: team.teamId);
    });

/// Saison d'une équipe de la poule (classement + parcours), calculée par
/// [buildPoolTeamSeason]. `null` si l'équipe n'apparaît pas dans la poule.
final poolTeamSeasonProvider = Provider.autoDispose
    .family<AsyncValue<PoolTeamSeason?>, PoolTeamRef>((ref, target) {
      final team = (clubId: target.clubId, teamId: target.teamId);
      final standings = ref.watch(teamStandingsProvider(team));
      final matches = ref.watch(poolMatchesProvider(team));
      if (standings.hasError) {
        return AsyncValue.error(standings.error!, standings.stackTrace!);
      }
      if (matches.hasError) {
        return AsyncValue.error(matches.error!, matches.stackTrace!);
      }
      if (!standings.hasValue || !matches.hasValue) {
        return const AsyncValue.loading();
      }
      return AsyncValue.data(
        buildPoolTeamSeason(
          standings: standings.value,
          matches: matches.value!,
          teamKey: target.poolTeamKey,
        ),
      );
    });

/// Équipes liées à une poule fédérale que l'utilisateur suit (joueur,
/// coach, ou parent d'un joueur), tous clubs confondus : icône coupe de la
/// home. Triées par nom.
final homeStandingsTeamsProvider = Provider<List<ClubTeam>>((ref) {
  final uid = ref.watch(viroUserProvider).value?.uid;
  final clubs = ref.watch(userClubsProvider).value ?? const [];
  final teamsByClub = ref.watch(homeClubTeamsProvider).value ?? const {};
  if (uid == null) return const [];

  final result = <ClubTeam>[];
  for (final entry in clubs) {
    final followedIds = {
      uid,
      for (final link in entry.parentLinks) link.memberId,
    };
    final teams = teamsByClub[entry.club.id]?.values ?? const <ClubTeam>[];
    for (final team in teams) {
      if (team.federation == null) continue;
      final roster = {...team.playerIds, ...team.coachIds};
      if (roster.any(followedIds.contains)) result.add(team);
    }
  }
  result.sort((a, b) => a.name.compareTo(b.name));
  return result;
});
