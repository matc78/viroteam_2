import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Ligne « qui a réagi » du popup de réactions (avatar + nom + emoji).
///
/// [mine] : réaction du viewer, affichée « Vous » et retirable au tap.
class ChatReactorListTile extends StatelessWidget {
  const ChatReactorListTile({
    super.key,
    required this.emoji,
    required this.firstName,
    required this.mine,
    this.member,
    this.onTap,
  });

  final String emoji;

  /// Prénom résolu du réacteur (vide si inconnu).
  final String firstName;
  final bool mine;
  final ClubMember? member;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final displayName = mine
        ? AppCopy.chat.you
        : (firstName.isNotEmpty ? firstName : AppCopy.common.memberFallback);
    return ListTile(
      dense: true,
      leading: _ReactorAvatar(member: member, firstName: firstName),
      title: Text(
        displayName,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: mine ? Text(AppCopy.chat.reactionRemoveMine) : null,
      trailing: Text(
        emoji,
        style: const TextStyle(fontSize: 22),
      ),
      onTap: mine ? onTap : null,
    );
  }
}

/// Avatar : photo si dispo, sinon initiale du prénom (jamais celle de « Vous »).
class _ReactorAvatar extends StatelessWidget {
  const _ReactorAvatar({required this.member, required this.firstName});

  final ClubMember? member;
  final String firstName;

  @override
  Widget build(BuildContext context) {
    final member = this.member;
    final photoUrl = member?.avatarUrl?.trim();
    final hasPhoto = member != null &&
        member.hasLinkedAccount &&
        photoUrl != null &&
        photoUrl.isNotEmpty;

    if (hasPhoto) {
      return MemberAvatar(member: member, size: 36);
    }

    final preferred = member?.preferredFirstName.trim() ?? '';
    final fromMember =
        preferred.isNotEmpty && preferred != AppCopy.common.childFallback
            ? preferred
            : (member?.fullName.trim() ?? '');
    final initialSource = firstName.isNotEmpty ? firstName : fromMember;
    final initial =
        initialSource.isNotEmpty ? initialSource[0].toUpperCase() : '?';

    final palette = context.viroPalette;
    return CircleAvatar(
      radius: 18,
      backgroundColor: palette.accentSoft,
      child: Text(
        initial,
        style: TextStyle(
          color: palette.brandText,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
