import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/member/member_activation.dart';
import 'package:viro_team_v2/services/member_service.dart';

final clubMembersProvider = StreamProvider.family<List<ClubMember>, String>((
  ref,
  clubId,
) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value([]);
  return ref.read(memberServiceProvider).watchClubMembers(clubId);
});

/// Membres + codes d’invitation pending (écran membres / coach-admin).
final clubMembersWithInvitesProvider =
    StreamProvider.family<List<ClubMember>, String>((ref, clubId) {
      final auth = ref.watch(firestoreAuthReadyProvider).value;
      if (auth == null) return Stream.value([]);
      return ref
          .read(memberServiceProvider)
          .watchClubMembers(clubId, enrichPendingInvites: true);
    });

final clubParentsProvider =
    FutureProvider.family<List<ClubParentEntry>, String>((ref, clubId) {
      return ref.read(memberServiceProvider).fetchClubParents(clubId);
    });

final clubForMembersProvider = FutureProvider.family<Club?, String>((
  ref,
  clubId,
) {
  return ref.read(clubServiceProvider).getClub(clubId);
});

/// Compteurs d’activation des comptes de l’effectif (carte de suivi de
/// l’écran Gérer les membres), `null` tant que la liste charge.
final clubMemberActivationStatsProvider =
    Provider.family<MemberActivationStats?, String>((ref, clubId) {
      final members = ref.watch(clubMembersWithInvitesProvider(clubId)).value;
      return members == null ? null : MemberActivationStats.of(members);
    });
