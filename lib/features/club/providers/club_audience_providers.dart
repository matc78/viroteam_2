import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

/// Cible des actions dans un club : sa fiche ou un enfant.
enum FamilyAudienceKind { self, child }

/// Une puce Moi / prénom enfant.
class FamilyAudienceTarget {
  const FamilyAudienceTarget({
    required this.memberId,
    required this.label,
    required this.kind,
  });

  final String memberId;
  final String label;
  final FamilyAudienceKind kind;

  bool get isChild => kind == FamilyAudienceKind.child;
  bool get isSelf => kind == FamilyAudienceKind.self;
}

/// Cibles Moi + enfants du club (pas un rôle parent).
final clubFamilyTargetsProvider =
    FutureProvider.family<List<FamilyAudienceTarget>, String>(
        (ref, clubId) async {
  final user = ref.watch(viroUserProvider).value;
  if (user == null) return const [];

  final selfMemberAsync = ref.watch(clubMemberProvider(clubId));
  if (user.isLicensedInClub(clubId) && selfMemberAsync.isLoading) {
    return const [];
  }
  final selfMember = selfMemberAsync.value;
  final childLinks = user.activeParentLinksInClub(clubId);
  final guardianService = ref.read(guardianServiceProvider);
  final targets = <FamilyAudienceTarget>[];

  if (selfMember != null) {
    targets.add(
      FamilyAudienceTarget(
        memberId: selfMember.memberId,
        label: 'Moi',
        kind: FamilyAudienceKind.self,
      ),
    );
  }

  for (final link in childLinks) {
    if (selfMember != null && link.memberId == selfMember.memberId) {
      continue;
    }
    final firstName = await guardianService.childFirstName(
      clubId: clubId,
      memberId: link.memberId,
    );
    targets.add(
      FamilyAudienceTarget(
        memberId: link.memberId,
        label: firstName,
        kind: FamilyAudienceKind.child,
      ),
    );
  }

  return targets;
});

class ClubAudienceSelectionNotifier extends Notifier<Map<String, String>> {
  @override
  Map<String, String> build() => {};

  /// Enregistre la fiche cible (Moi ou enfant) pour [clubId].
  void select({required String clubId, required String memberId}) {
    state = {...state, clubId: memberId};
  }
}

final clubAudienceSelectionProvider =
    NotifierProvider<ClubAudienceSelectionNotifier, Map<String, String>>(
  ClubAudienceSelectionNotifier.new,
);

/// Cible sélectionnée pour le club. Défaut : Moi si licencié, sinon 1er enfant.
final selectedClubAudienceProvider =
    Provider.family<FamilyAudienceTarget?, String>((ref, clubId) {
  final targets = ref.watch(clubFamilyTargetsProvider(clubId)).value ?? const [];
  if (targets.isEmpty) return null;

  final storedId = ref.watch(clubAudienceSelectionProvider)[clubId];
  for (final target in targets) {
    if (target.memberId == storedId) return target;
  }

  final licensed = targets.any((target) => target.isSelf);
  if (licensed) {
    return targets.firstWhere((target) => target.isSelf);
  }
  return targets.first;
});

/// `true` si le segment Moi | enfant (ou puces multi-enfants) doit s’afficher.
bool shouldShowAudienceSwitcher(List<FamilyAudienceTarget> targets) {
  final hasSelf = targets.any((target) => target.isSelf);
  final childCount = targets.where((target) => target.isChild).length;
  if (targets.length <= 1) return false;
  if (!hasSelf && childCount <= 1) return false;
  return true;
}

/// Fiche membre de la cible (enfant ou soi).
final clubAudienceMemberProvider =
    FutureProvider.family<ClubMember?, String>((ref, clubId) async {
  final target = ref.watch(selectedClubAudienceProvider(clubId));
  if (target == null) return null;
  if (target.isSelf) {
    return ref.watch(clubMemberProvider(clubId)).value;
  }
  return ref.read(guardianServiceProvider).getClubMember(
        clubId: clubId,
        memberId: target.memberId,
      );
});
