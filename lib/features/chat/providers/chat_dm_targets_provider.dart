import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/chat/chat_dm_targets_service.dart';

/// Cibles DM (coaches des équipes du caller + admins) pour un club.
///
/// Instantané à l'ouverture de la sheet (lectures `read`, pas de `watch`) ;
/// autoDispose → rechargé à chaque ouverture. Liste vide en cas d'erreur.
final chatDmTargetsProvider = FutureProvider.autoDispose
    .family<List<ChatDmTarget>, String>((ref, clubId) async {
  final uid = ref.read(authStateProvider).value?.uid;
  if (uid == null) return const [];

  final service = ref.read(chatDmTargetsServiceProvider);
  try {
    final clubs = ref.read(userClubsProvider).value ?? const [];
    final clubEntry = clubs.where((e) => e.club.id == clubId).firstOrNull;
    final isGuardianOnly = ref.read(isGuardianOnlyInClubProvider(clubId));

    var guardianChildTeamIds = const <String>[];
    String? callerMemberId;
    if (isGuardianOnly) {
      try {
        guardianChildTeamIds = await ref
            .read(guardianChildTeamIdsProvider(clubId).future)
            .timeout(kChatDmTargetsLoadTimeout);
      } catch (_) {}
    } else {
      // Warm fiche membre (best-effort) pour résoudre memberId → équipes.
      try {
        await ref
            .read(clubMemberProvider(clubId).future)
            .timeout(kChatDmTargetsFetchTimeout);
      } catch (_) {}
      callerMemberId = ref.read(clubMemberProvider(clubId)).value?.memberId;
    }

    final callerTeams = await service.loadCallerTeams(
      clubId: clubId,
      uid: uid,
      isGuardianOnly: isGuardianOnly,
      guardianChildTeamIds: guardianChildTeamIds,
      callerMemberId: callerMemberId,
    );

    return await service.loadTargets(
      clubId: clubId,
      callerUid: uid,
      clubAdminIds: clubEntry?.club.adminIds ?? const [],
      callerTeams: callerTeams,
      isGuardianOnly: isGuardianOnly,
    );
  } catch (_) {
    return const [];
  }
});
