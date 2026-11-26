import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/home/providers/home_teams_provider.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/providers/session_provider.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';
import 'package:viro_team_v2/services/standings/standings_switcher.dart';
import 'package:viro_team_v2/services/standings_preference_service.dart';

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

/// Prénoms des enfants suivis (liens parent actifs) : club → fiche → prénom.
/// Repris des cibles Moi / enfants de chaque club ([clubFamilyTargetsProvider],
/// déjà lu par le sélecteur d'audience) : aucune lecture en plus. Un club
/// encore en chargement ou en erreur est absent de la carte.
final standingsChildNamesProvider = Provider<Map<String, Map<String, String>>>((
  ref,
) {
  final clubIds = ref.watch(
    viroUserProvider.select(
      (user) => {
        for (final link in user.value?.activeParentLinks ?? const [])
          link.clubId,
      }.join(','),
    ),
  );
  if (clubIds.isEmpty) return const {};
  return {
    for (final clubId in clubIds.split(','))
      // Liste vide = fiche « Moi » encore en chargement (voir le provider).
      if (ref.watch(clubFamilyTargetsProvider(clubId)).value case final targets?
          when targets.isNotEmpty)
        clubId: {
          for (final target in targets)
            if (target.isChild) target.memberId: target.label,
        },
  };
});

/// Classements suivis (joueur, coach ou parent d'un joueur), par club : club
/// actif d'abord, une entrée par poule. Coupe de la home et barres de choix
/// de l'écran Classement.
final standingsGroupsProvider = Provider<List<StandingsClubGroup>>((ref) {
  final uid = ref.watch(viroUserProvider).value?.uid;
  final clubs = ref.watch(userClubsProvider).value ?? const [];
  final teamsByClub = ref.watch(homeClubTeamsProvider).value ?? const {};
  final childNames = ref.watch(standingsChildNamesProvider);
  final activeClubId = ref.watch(sessionProvider).activeClubId;
  if (uid == null) return const [];

  return buildStandingsGroups(
    uid: uid,
    activeClubId: activeClubId,
    clubs: [
      for (final entry in clubs)
        StandingsClubSource(
          clubId: entry.club.id,
          clubName: entry.club.name,
          teams: teamsByClub[entry.club.id]?.values.toList() ?? const [],
          // Prénom vide tant que le club charge (masqué à l'affichage),
          // repli « Enfant » seulement si la fiche reste introuvable.
          childNames: {
            for (final link in entry.parentLinks)
              link.memberId: switch (childNames[entry.club.id]) {
                null => '',
                final names =>
                  names[link.memberId] ?? AppCopy.common.childFallback,
              },
          },
        ),
    ],
  );
});

/// Derniers classements consultés par le compte connecté (persistés sur
/// l'appareil).
class StandingsLastViewedNotifier extends Notifier<StandingsLastViewed> {
  @override
  StandingsLastViewed build() {
    final uid = ref.watch(authUidProvider);
    if (uid == null) return const StandingsLastViewed();
    return ref.read(standingsPreferenceServiceProvider).readSync(uid);
  }

  /// Retient la consultation de [teamId] dans [clubId].
  void record({required String clubId, required String teamId}) {
    final uid = ref.read(authUidProvider);
    if (uid == null) return;
    if (state.clubId == clubId && state.teamId == teamId) return;
    state = state.record(clubId, teamId);
    ref.read(standingsPreferenceServiceProvider).write(uid, state);
  }
}

final standingsLastViewedProvider =
    NotifierProvider<StandingsLastViewedNotifier, StandingsLastViewed>(
      StandingsLastViewedNotifier.new,
    );

/// Classement ouvert par la coupe de la home : le dernier consulté s'il
/// est toujours suivi, sinon le premier (club actif puis nom). `null` sans
/// classement suivi.
final standingsHomeTargetProvider = Provider<StandingsTeamRef?>((ref) {
  final groups = ref.watch(standingsGroupsProvider);
  if (groups.isEmpty) return null;
  final last = ref.watch(standingsLastViewedProvider);
  if (last.clubId != null && last.teamId != null) {
    final entry = findStandingsEntry(
      groups,
      clubId: last.clubId!,
      teamId: last.teamId!,
    );
    if (entry != null) {
      return (clubId: entry.clubId, teamId: entry.primary.id);
    }
  }
  final first = groups.first.entries.first;
  return (clubId: first.clubId, teamId: first.primary.id);
});

/// Entrée du sélecteur contenant l'équipe, `null` si elle n'est pas suivie.
final standingsEntryProvider =
    Provider.family<StandingsEntry?, StandingsTeamRef>((ref, team) {
      return findStandingsEntry(
        ref.watch(standingsGroupsProvider),
        clubId: team.clubId,
        teamId: team.teamId,
      );
    });

/// Meilleure position des équipes suivies de l'entrée de l'équipe (badge
/// de rang des puces), `null` avant la synchro ou si non classée.
final standingsEntryRankProvider = Provider.autoDispose
    .family<int?, StandingsTeamRef>((ref, team) {
      final entry = ref.watch(standingsEntryProvider(team));
      if (entry == null) return null;
      final standings = ref.watch(
        teamStandingsProvider((clubId: entry.clubId, teamId: entry.primary.id)),
      );
      return bestStandingRank(standings.value, entry.teamKeys);
    });
