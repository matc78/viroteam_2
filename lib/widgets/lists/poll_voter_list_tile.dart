import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Ligne votant dans le détail d’un sondage (avatar + nom + heure du vote +
/// rôle).
class PollVoterListTile extends StatelessWidget {
  const PollVoterListTile({
    super.key,
    required this.displayName,
    this.member,
    this.voteTime,
    this.now,
  });

  final String displayName;
  final ClubMember? member;

  /// Heure du vote (ou de sa dernière modification) ; `null` pour les votes
  /// antérieurs au suivi.
  final ChatPollVoteTime? voteTime;

  /// « Maintenant » injectable (tests) ; défaut [DateTime.now].
  final DateTime? now;

  /// « Voté à 14:43 » aujourd’hui, « Modifié le 4/11 à 09:12 » sinon.
  String? _voteMomentLabel() {
    final time = voteTime;
    if (time == null) return null;
    final at = time.at.toLocal();
    final today = now ?? DateTime.now();
    final sameDay =
        at.year == today.year && at.month == today.month && at.day == today.day;
    return AppCopy.chat.pollVoteMoment(
      edited: time.edited,
      time: formatChatMessageTime(at),
      day: sameDay ? null : formatDayMonth(at),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final voteMoment = _voteMomentLabel();

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.screenHorizontal,
        vertical: ViroSpacing.sm,
      ),
      child: Row(
        children: [
          if (member != null)
            MemberAvatar(member: member!, size: 40)
          else
            CircleAvatar(
              radius: 20,
              backgroundColor: palette.accentSoft,
              child: Text(
                displayName.isNotEmpty
                    ? displayName.substring(0, 1).toUpperCase()
                    : '?',
                style: theme.titleSmall?.copyWith(
                  color: palette.accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.bodyLarge?.copyWith(
                    color: palette.brandText,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (voteMoment != null)
                  Text(
                    voteMoment,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
          if (member != null)
            ViroRoleBadge(
              role: viroRoleFromMemberRole(member!.role),
              compact: true,
            ),
        ],
      ),
    );
  }
}
