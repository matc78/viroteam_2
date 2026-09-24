import 'dart:math';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_bubble_timestamp.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Nombre max d’avatars empilés par option de sondage.
const int _kMaxPollAvatars = 3;
const double _kPollAvatarSize = 22;
const double _kPollAvatarOverlap = 14;

/// Bulle de sondage avec barres de votes (style WhatsApp).
class ChatPollBubble extends StatelessWidget {
  const ChatPollBubble({
    super.key,
    required this.message,
    required this.mine,
    required this.viewerUid,
    required this.onVote,
    required this.onLongPress,
    this.memberByUid = const {},
    this.onViewVotes,
    this.borderColor,
    this.senderLabel = '',
  });

  final ChatMessage message;
  final bool mine;
  final String? viewerUid;
  final ValueChanged<String> onVote;
  final VoidCallback onLongPress;
  final Map<String, ClubMember> memberByUid;
  final VoidCallback? onViewVotes;
  final Color? borderColor;
  /// Prénom + nom en haut de bulle (groupes, messages des autres).
  final String senderLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final align = mine ? Alignment.centerRight : Alignment.centerLeft;
    final total = message.pollTotalVotes;
    final uniqueVoters = message.pollUniqueVoterCount;
    final question =
        (message.pollQuestion ?? message.text ?? '').trim();

    return Align(
      alignment: align,
      child: GestureDetector(
        onLongPress: onLongPress,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.82,
          ),
          decoration: BoxDecoration(
            color: ViroColors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: borderColor ?? ViroColors.primary100,
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (senderLabel.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    senderLabel,
                    style: theme.labelSmall?.copyWith(
                      color: borderColor ?? ViroColors.primary600,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              Row(
                children: [
                  ViroIcon(
                    ViroIcons.poll,
                    size: 16,
                    color: ViroColors.primary600,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    AppCopy.chat.pollLabel,
                    style: theme.labelSmall?.copyWith(
                      color: ViroColors.primary600,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                question,
                style: theme.titleSmall?.copyWith(
                  color: ViroColors.primary800,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                message.pollAllowMultiple
                    ? AppCopy.chat.pollAllowMultiple
                    : AppCopy.chat.pollSingleChoice,
                style: theme.labelSmall?.copyWith(
                  color: ViroColors.gray600,
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              for (final option in message.pollOptions)
                _PollOptionRow(
                  option: option,
                  voterUids: message.pollVotes[option.id] ?? const <String>[],
                  memberByUid: memberByUid,
                  totalVotes: total,
                  allowMultiple: message.pollAllowMultiple,
                  selected: viewerUid != null &&
                      message.hasVotedFor(viewerUid!, option.id),
                  onTap: viewerUid == null
                      ? null
                      : () => onVote(option.id),
                ),
              const SizedBox(height: ViroSpacing.xs),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      AppCopy.chat.pollVotersLabel(uniqueVoters),
                      style: theme.labelSmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                  ),
                  ChatBubbleTimestamp(
                    sentAt: message.createdAt,
                    edited: message.editedAt != null,
                  ),
                ],
              ),
              if (onViewVotes != null) ...[
                const SizedBox(height: ViroSpacing.sm),
                Divider(height: 1, color: ViroColors.primary100),
                ViroPressable(
                  onTap: onViewVotes,
                  child: Padding(
                    padding: const EdgeInsets.only(top: ViroSpacing.sm),
                    child: Center(
                      child: Text(
                        AppCopy.chat.viewVotes,
                        style: theme.labelLarge?.copyWith(
                          color: ViroColors.primary600,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _PollOptionRow extends StatelessWidget {
  const _PollOptionRow({
    required this.option,
    required this.voterUids,
    required this.memberByUid,
    required this.totalVotes,
    required this.allowMultiple,
    required this.selected,
    required this.onTap,
  });

  final ChatPollOption option;
  final List<String> voterUids;
  final Map<String, ClubMember> memberByUid;
  final int totalVotes;
  final bool allowMultiple;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final voteCount = voterUids.length;
    final ratio = totalVotes <= 0 ? 0.0 : voteCount / totalVotes;
    final marker = allowMultiple
        ? (selected ? ViroIcons.checkboxOn : ViroIcons.checkboxOff)
        : (selected ? ViroIcons.radioOn : ViroIcons.radioOff);

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
      child: ViroPressable(
        onTap: onTap,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Container(
            decoration: BoxDecoration(
              color: ViroColors.primary50,
              border: Border.all(
                color:
                    selected ? ViroColors.primary600 : ViroColors.primary100,
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: FractionallySizedBox(
                      widthFactor: ratio.clamp(0.0, 1.0),
                      child: ColoredBox(
                        color: ViroColors.primary100.withValues(alpha: 0.9),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 10,
                  ),
                  child: Row(
                    children: [
                      ViroIcon(
                        marker,
                        size: 18,
                        color: selected
                            ? ViroColors.primary600
                            : ViroColors.gray400,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          option.text,
                          style: theme.bodyMedium?.copyWith(
                            color: ViroColors.primary800,
                            fontWeight:
                                selected ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ),
                      if (voteCount > 0) ...[
                        const SizedBox(width: ViroSpacing.xs),
                        _PollVoterAvatarStack(
                          optionId: option.id,
                          voterUids: voterUids,
                          memberByUid: memberByUid,
                        ),
                        const SizedBox(width: ViroSpacing.xs),
                      ],
                      Text(
                        '$voteCount',
                        style: theme.labelSmall?.copyWith(
                          color: ViroColors.gray600,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Empile jusqu’à [_kMaxPollAvatars] avatars dans un ordre aléatoire stable.
class _PollVoterAvatarStack extends StatelessWidget {
  const _PollVoterAvatarStack({
    required this.optionId,
    required this.voterUids,
    required this.memberByUid,
  });

  final String optionId;
  final List<String> voterUids;
  final Map<String, ClubMember> memberByUid;

  @override
  Widget build(BuildContext context) {
    final shuffled = List<String>.from(voterUids)
      ..shuffle(Random(optionId.hashCode));
    final visible = shuffled.take(_kMaxPollAvatars).toList();
    if (visible.isEmpty) return const SizedBox.shrink();

    final stackWidth = _kPollAvatarSize +
        (visible.length - 1) * _kPollAvatarOverlap;

    return SizedBox(
      width: stackWidth,
      height: _kPollAvatarSize,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (var index = 0; index < visible.length; index++)
            Positioned(
              left: index * _kPollAvatarOverlap,
              child: _PollVoterAvatarBubble(
                member: memberByUid[visible[index]],
              ),
            ),
        ],
      ),
    );
  }
}

/// Bulle avatar compacte (sans zoom) pour une pile de votants.
class _PollVoterAvatarBubble extends StatelessWidget {
  const _PollVoterAvatarBubble({this.member});

  final ClubMember? member;

  @override
  Widget build(BuildContext context) {
    final avatar = member != null
        ? IgnorePointer(
            child: MemberAvatar(
              member: member!,
              size: _kPollAvatarSize,
            ),
          )
        : Container(
            width: _kPollAvatarSize,
            height: _kPollAvatarSize,
            alignment: Alignment.center,
            color: ViroColors.primary100,
            child: ViroIcon(
              ViroIcons.user,
              size: _kPollAvatarSize * 0.45,
              color: ViroColors.primary600,
            ),
          );

    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: ViroColors.white, width: 1.5),
      ),
      child: ClipOval(child: avatar),
    );
  }
}
