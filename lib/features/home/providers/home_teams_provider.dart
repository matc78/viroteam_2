import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/stream_combine.dart';

/// Équipes de tous les clubs de l'utilisateur (aperçu home multi-clubs).
final homeClubTeamsProvider =
    StreamProvider<Map<String, Map<String, ClubTeam>>>((ref) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  final clubs = ref.watch(userClubsProvider).value;
  final user = ref.watch(viroUserProvider).value;
  if (auth == null || clubs == null || clubs.isEmpty) return Stream.value({});

  final teamService = ref.read(teamServiceProvider);
  final guardianService = ref.read(guardianServiceProvider);

  final streams = clubs.map((entry) {
    final clubId = entry.club.id;
    List<MapEntry<String, Map<String, ClubTeam>>> toEntry(
      List<ClubTeam> teams,
    ) =>
        [MapEntry(clubId, {for (final t in teams) t.id: t})];

    // Parent sans fiche : `list` refusé → équipes de l'enfant par id.
    if (!entry.isLicensed && entry.hasFamilyLinks && user != null) {
      return Stream.fromFuture(
        loadGuardianChildTeamIds(
          guardianService: guardianService,
          user: user,
          clubId: clubId,
        ),
      ).asyncExpand(
        (childTeamIds) => teamService
            .watchTeamsByIds(clubId: clubId, teamIds: childTeamIds)
            .map(toEntry),
      );
    }
    return teamService.watchClubTeams(clubId: clubId).map(toEntry);
  }).toList();

  return combineLatestListStreams<MapEntry<String, Map<String, ClubTeam>>>(
    streams,
  ).map(
    (entries) => Map<String, Map<String, ClubTeam>>.fromEntries(entries),
  );
});
