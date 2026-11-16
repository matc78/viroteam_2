import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/models/club_permission.dart';

/// Prénom et badge dénormalisés sur un message envoyé (`senderFirstName`,
/// `senderRole`).
typedef ChatSenderMeta = ({String firstName, String senderRole});

/// Expéditeur du compte connecté dans le club [clubId] : source unique pour
/// les messages et les sondages.
///
/// Membre du club (`users/{uid}.memberClubIds`) : badge principal de sa
/// fiche, **attendue** avant de répondre (jamais `member` par défaut pendant
/// le chargement). Sinon participant parent.
final chatSenderMetaProvider = FutureProvider.family<ChatSenderMeta, String>((
  ref,
  clubId,
) async {
  final user = await ref.watch(viroUserProvider.future);
  final firstName = (user?.firstName.trim().isNotEmpty == true)
      ? user!.firstName.trim()
      : (user?.displayName.trim().split(RegExp(r'\s+')).firstOrNull ?? '');
  final isClubMember = user?.memberClubIds.contains(clubId) ?? false;
  if (!isClubMember) {
    return (firstName: firstName, senderRole: ChatBadgeIds.parent);
  }
  final member = await ref.watch(clubMemberProvider(clubId).future);
  return (
    firstName: firstName,
    senderRole: ChatBadgeIds.of(member?.primaryBadge ?? MemberBadge.member),
  );
});
