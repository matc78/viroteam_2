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

  final children = [
    for (final link in childLinks)
      if (selfMember == null || link.memberId != selfMember.memberId) link,
  ];
  // Lectures en parallèle ; une fiche illisible retombe seule sur « Enfant ».
  final firstNames = await Future.wait(
    children.map(
      (link) => guardianService
          .childFirstName(clubId: clubId, memberId: link.memberId)
          .catchError((Object _) => AppCopy.common.childFallback),
    ),
  );
  for (final (index, link) in children.indexed) {
    targets.add(
      FamilyAudienceTarget(
        memberId: link.memberId,
        label: firstNames[index],
        kind: FamilyAudienceKind.child,
      ),
    );
  }

  return targets;
});

class ClubAudienceSelectionNotifier extends Notifier<Map<String, String>> {
  /// Sélection vide, recréée à chaque changement de compte : les enfants
  /// choisis par le compte précédent ne survivent pas à la déconnexion.
  @override
  Map<String, String> build() {
    ref.watch(authUidProvider);
    return {};
  }

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

/// `true` tant que la cible (Moi | enfant) du club n'est pas encore connue.
///
/// Les écrans ciblés (fiche club, cotisation) attendent plutôt que de
/// retomber sur le compte connecté : un parent verrait sinon sa propre vue
/// (et répondrait pour lui) avant que l'enfant sélectionné n'apparaisse.
/// Une erreur de chargement n'est pas une attente infinie : `false`.
final clubAudienceResolvingProvider =
    Provider.family<bool, String>((ref, clubId) {
  final targetsAsync = ref.watch(clubFamilyTargetsProvider(clubId));
  if (targetsAsync.hasError) return false;
  // Une cible déjà connue (même pendant un rechargement) suffit.
  if ((targetsAsync.value ?? const []).isNotEmpty) return false;
  if (targetsAsync.isLoading) return true;
  // Licencié dont la fiche charge encore : la liste vide est provisoire.
  final user = ref.watch(viroUserProvider).value;
  if (user == null || !user.isLicensedInClub(clubId)) return false;
  final selfMemberAsync = ref.watch(clubMemberProvider(clubId));
  return !selfMemberAsync.hasValue && !selfMemberAsync.hasError;
});

/// Fiche à mettre en avant (épinglée, en gras) dans les effectifs d'équipe :
/// l'enfant si un enfant est sélectionné, sinon sa propre fiche.
///
/// Pendant le chargement des cibles, s'appuie sur la sélection déjà connue
/// (synchrone) pour ne pas afficher sa fiche puis basculer sur l'enfant.
final rosterSessionMemberIdProvider =
    Provider.family<String?, String>((ref, clubId) {
  final selfMemberId = ref.watch(clubMemberProvider(clubId)).value?.memberId;
  final targetsAsync = ref.watch(clubFamilyTargetsProvider(clubId));
  if (!targetsAsync.hasValue) {
    return ref.watch(clubAudienceSelectionProvider)[clubId] ?? selfMemberId;
  }
  return ref.watch(selectedClubAudienceProvider(clubId))?.memberId ??
      selfMemberId;
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
/// [memberId] : id de la fiche ciblée (`authUid` pour soi, `memberId` de
/// l'enfant sinon), clé lue et écrite dans `rsvp` ; [viaCallable] : écriture
/// via `setEventRsvp` (parent pour un enfant).
typedef RsvpTarget = ({
  String memberId,
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
    memberId: selected.memberId,
    member: childMember,
    viaCallable: true,
  );
}

/// Pour qui une vue répond aux convocations : le compte connecté (accueil,
/// planning perso : leurs événements sont ceux de l'uid connecté) ou la
/// cible Moi | enfant sélectionnée dans le club (planning du club).
enum RsvpAudience { self, selectedAudience }

/// Cible RSVP « soi » dans [clubId] : sa fiche `members/{uid}`, écriture
/// directe. `null` si déconnecté.
final selfRsvpTargetProvider =
    Provider.family<RsvpTarget?, String>((ref, clubId) {
  final authUid = ref.watch(authStateProvider).value?.uid;
  if (authUid == null) return null;
  return (
    memberId: authUid,
    member: ref.watch(clubMemberProvider(clubId)).value,
    viaCallable: false,
  );
});

/// Cible RSVP du club : enfant sélectionné ou compte connecté.
///
/// Attend que les cibles Moi | enfant soient connues : pendant leur
/// chargement, retomber sur le compte connecté ferait répondre le parent
/// pour lui-même alors qu'un enfant est sélectionné.
final rsvpTargetProvider =
    FutureProvider.family<RsvpTarget?, String>((ref, clubId) async {
  final authUid = ref.watch(authStateProvider).value?.uid;
  if (authUid == null) return null;

  // Dépendances lues avant toute attente : un changement relance le calcul.
  final selected = ref.watch(selectedClubAudienceProvider(clubId));
  final selfTarget = ref.watch(selfRsvpTargetProvider(clubId));
  final targetsReady = ref.watch(clubFamilyTargetsProvider(clubId).future);
  if (selected != null && selected.isChild) {
    final childMember =
        await ref.watch(clubAudienceMemberProvider(clubId).future);
    return childRsvpTarget(selected: selected, childMember: childMember);
  }
  await targetsReady;
  return selfTarget;
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
