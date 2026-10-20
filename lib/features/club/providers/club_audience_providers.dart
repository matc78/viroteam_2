import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/parent_link.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// ID enfant à afficher (avatar listes) : sélection audience si enfant valide,
/// sinon 1er lien actif. `null` si aucun lien.
String? resolveFamilyPrimaryChildMemberId({
  required List<ParentLink> childLinks,
  required FamilyAudienceTarget? selectedAudience,
}) {
  if (childLinks.isEmpty) return null;

  final selectedChildId =
      selectedAudience != null && selectedAudience.isChild
          ? selectedAudience.memberId
          : null;
  if (selectedChildId != null &&
      childLinks.any((link) => link.memberId == selectedChildId)) {
    return selectedChildId;
  }
  return childLinks.first.memberId;
}

/// Fiche enfant affichée en liste (parent seul dans le club) —
/// suit [selectedClubAudienceProvider], sinon 1er lien actif.
final familyPrimaryChildProvider =
    FutureProvider.family<ClubMember?, String>((ref, clubId) async {
  final user = ref.watch(viroUserProvider).value;
  if (user == null || user.isLicensedInClub(clubId)) return null;

  final childLinks = user.activeParentLinksInClub(clubId);
  final memberId = resolveFamilyPrimaryChildMemberId(
    childLinks: childLinks,
    selectedAudience: ref.watch(selectedClubAudienceProvider(clubId)),
  );
  if (memberId == null) return null;

  return ref.read(guardianServiceProvider).getClubMember(
        clubId: clubId,
        memberId: memberId,
      );
});

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
        label: AppCopy.club.familyAudienceMe,
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

/// Cible d'un RSVP dans un club.
///
/// [subjectId] : clé passée aux helpers RSVP de `ClubEvent` (`authUid` pour
/// soi, `memberId` de l'enfant sinon) ; [audienceId] : clé écrite dans `rsvp` ;
/// [viaCallable] : écriture via `setEventRsvp` (parent pour un enfant).
typedef RsvpTarget = ({
  String subjectId,
  String audienceId,
  ClubMember? member,
  bool viaCallable,
});

/// Cible RSVP quand [selected] est un enfant, sinon `null` (cible = soi).
RsvpTarget? childRsvpTarget({
  required FamilyAudienceTarget? selected,
  required ClubMember? childMember,
}) {
  if (selected == null || !selected.isChild) return null;
  return (
    subjectId: selected.memberId,
    audienceId: selected.memberId,
    member: childMember,
    viaCallable: true,
  );
}

/// Cible RSVP du club : enfant sélectionné ou compte connecté.
final rsvpTargetProvider =
    FutureProvider.family<RsvpTarget?, String>((ref, clubId) async {
  final authUid = ref.watch(authStateProvider).value?.uid;
  if (authUid == null) return null;

  final selected = ref.watch(selectedClubAudienceProvider(clubId));
  if (selected != null && selected.isChild) {
    final childMember =
        await ref.watch(clubAudienceMemberProvider(clubId).future);
    return childRsvpTarget(selected: selected, childMember: childMember);
  }

  final selfMember = ref.watch(clubMemberProvider(clubId)).value;
  final audienceId = await ref.read(eventServiceProvider).resolveAudienceId(
        clubId: clubId,
        authUid: authUid,
      );
  return (
    subjectId: authUid,
    audienceId: audienceId,
    member: selfMember,
    viaCallable: false,
  );
});

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
