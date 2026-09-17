import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_bubble_timestamp.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Bulle de sondage avec barres de votes (style WhatsApp).
class ChatPollBubble extends StatelessWidget {
  const ChatPollBubble({
    super.key,
    required this.message,
    required this.mine,
    required this.viewerUid,
    required this.onVote,
    required this.onLongPress,
    this.onViewVotes,
    this.borderColor,
  });

  final ChatMessage message;
  final bool mine;
  final String? viewerUid;
  final ValueChanged<String> onVote;
  final VoidCallback onLongPress;
  final VoidCallback? onViewVotes;
  final Color? borderColor;

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
                  voteCount: message.pollVotes[option.id]?.length ?? 0,
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
    required this.voteCount,
    required this.totalVotes,
    required this.allowMultiple,
    required this.selected,
    required this.onTap,
  });

  final ChatPollOption option;
  final int voteCount;
  final int totalVotes;
  final bool allowMultiple;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final ratio = totalVotes <= 0 ? 0.0 : voteCount / totalVotes;
    final percent = totalVotes <= 0 ? 0 : (ratio * 100).round();
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
                      Text(
                        '$percent%',
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
