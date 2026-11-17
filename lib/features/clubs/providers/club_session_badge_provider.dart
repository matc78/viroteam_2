import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Badge du compte dans [clubId] pour les listes de clubs (sélecteur,
/// accueil, messagerie) : badge principal de sa fiche `members/{uid}`, sinon
/// parent s'il suit un enfant, sinon `null`.
///
/// L'index `users.memberClubIds` ne porte pas de rôle : le badge vient de
/// la fiche du club (un `get` par club du compte, mis en cache par Riverpod).
final clubSessionBadgeProvider = Provider.family<ViroRole?, String>((
  ref,
  clubId,
) {
  final entries = ref.watch(userClubsProvider).value ?? const [];
  final entry = entries.where((e) => e.club.id == clubId).firstOrNull;
  if (entry == null) return null;
  final member = entry.isLicensed
      ? ref.watch(clubMemberProvider(clubId)).value
      : null;
  return viroRoleForClubSession(
    memberBadge: member?.primaryBadge,
    hasFamilyLinks: entry.hasFamilyLinks,
  );
});

/// Clubs où le compte peut créer un canal de messagerie (droit
/// `manageChat`, comme la callable `createCategoryChannel`).
final manageChatClubsProvider = Provider<List<Club>>((ref) {
  final entries = ref.watch(userClubsProvider).value ?? const [];
  return [
    for (final entry in entries)
      if (entry.isLicensed &&
          ref
              .watch(clubAccessProvider(entry.club.id))
              .can(ClubPermission.manageChat))
        entry.club,
  ];
});
