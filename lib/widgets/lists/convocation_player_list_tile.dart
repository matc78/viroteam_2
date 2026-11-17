import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_selection.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_selectable_row.dart';

/// Ligne joueur sélectionnable : convoqué (ligne teintée, coche pleine) ou
/// retiré de l'événement (ligne nue, « Pas convoqué » sur la même ligne :
/// la hauteur ne change pas).
class ConvocationPlayerListTile extends StatelessWidget {
  /// [onChanged] reçoit le nouvel état « convoqué » du joueur.
  const ConvocationPlayerListTile({
    super.key,
    required this.member,
    required this.convoked,
    required this.onChanged,
    this.enabled = true,
    this.accentColor,
  });

  final ClubMember member;
  final bool convoked;
  final ValueChanged<bool> onChanged;
  final bool enabled;

  /// Couleur club ; accent du thème par défaut.
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final name = member.fullName.isNotEmpty
        ? member.fullName
        : AppCopy.planning.unnamedMember;

    return ViroSelectableRow(
      selected: convoked,
      onChanged: enabled ? onChanged : null,
      accentColor: accentColor,
      title: name,
      leading: AnimatedOpacity(
        duration: ViroSelection.fillDuration,
        opacity: convoked ? 1 : ViroSelection.unselectedAvatarOpacity,
        child: MemberAvatar(member: member, size: 36),
      ),
      trailing: convoked
          ? null
          : Text(
              AppCopy.planning.notConvoked,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
    );
  }
}
