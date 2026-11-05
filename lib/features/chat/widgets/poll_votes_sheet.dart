import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/lists/poll_voter_list_tile.dart';

/// Ouvre le détail des votes d’un sondage en bottom sheet (glissable) :
/// question, résumé, votants groupés par option avec l’heure du vote.
Future<void> showPollVotesSheet({
  required BuildContext context,
  required String clubId,
  required String conversationId,
  required String messageId,
  required int participantCount,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      minChildSize: 0.35,
      maxChildSize: 0.92,
      builder: (context, scrollController) => _PollVotesSheetContent(
        clubId: clubId,
        conversationId: conversationId,
        messageId: messageId,
        participantCount: participantCount,
        scrollController: scrollController,
      ),
    ),
  );
}

/// Contenu live du sheet (le sondage peut recevoir des votes pendant
/// l’ouverture).
class _PollVotesSheetContent extends ConsumerWidget {
  const _PollVotesSheetContent({
    required this.clubId,
    required this.conversationId,
    required this.messageId,
    required this.participantCount,
    required this.scrollController,
  });

  final String clubId;
  final String conversationId;
  final String messageId;
  final int participantCount;
  final ScrollController scrollController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.viroPalette;
    final messageAsync = ref.watch(
      chatMessageProvider((
        clubId: clubId,
        conversationId: conversationId,
        messageId: messageId,
      )),
    );
    final members = ref.watch(
      chatThreadMembersProvider((
        clubId: clubId,
        conversationId: conversationId,
      )),
    );
    final memberByUid = <String, ClubMember>{
      for (final member in members)
        if (member.accountUid != null && member.accountUid!.isNotEmpty)
          member.accountUid!: member,
    };

    Widget centered(Widget child) => ListView(
      controller: scrollController,
      padding: const EdgeInsets.all(ViroSpacing.xl),
      children: [Center(child: child)],
    );
    final messageStyle = Theme.of(
      context,
    ).textTheme.bodyMedium?.copyWith(color: palette.textSecondary);

    return messageAsync.when(
      loading: () => centered(const CircularProgressIndicator()),
      error: (_, _) =>
          centered(Text(AppCopy.chat.loadError, style: messageStyle)),
      data: (message) {
        if (message == null || !message.isPoll || message.isDeleted) {
          return centered(
            Text(AppCopy.chat.pollUnavailable, style: messageStyle),
          );
        }
        return _PollVotesBody(
          message: message,
          memberByUid: memberByUid,
          participantCount: participantCount,
          scrollController: scrollController,
        );
      },
    );
  }
}

class _PollVotesBody extends StatelessWidget {
  const _PollVotesBody({
    required this.message,
    required this.memberByUid,
    required this.participantCount,
    required this.scrollController,
  });

  final ChatMessage message;
  final Map<String, ClubMember> memberByUid;
  final int participantCount;
  final ScrollController scrollController;

  String _nameFor(String uid) {
    final member = memberByUid[uid];
    if (member == null) return AppCopy.chat.pollUnknownVoter;
    final first = member.preferredFirstName.trim();
    if (first.isNotEmpty && first != AppCopy.common.childFallback) {
      return first;
    }
    final display = member.fullName.trim();
    if (display.isNotEmpty) return display.split(RegExp(r'\s+')).first;
    return AppCopy.chat.pollUnknownVoter;
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final question = (message.pollQuestion ?? message.text ?? '').trim();
    final voted = message.pollUniqueVoterCount;

    return ListView(
      controller: scrollController,
      padding: const EdgeInsets.only(bottom: ViroSpacing.xl),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            ViroSpacing.screenHorizontal,
            0,
            ViroSpacing.screenHorizontal,
            ViroSpacing.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                AppCopy.chat.pollDetailsTitle,
                style: theme.labelMedium?.copyWith(
                  color: palette.accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                question,
                style: theme.titleLarge?.copyWith(
                  color: palette.brandText,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                message.pollAllowMultiple
                    ? AppCopy.chat.pollAllowMultiple
                    : AppCopy.chat.pollSingleChoice,
                style: theme.bodyMedium?.copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                AppCopy.chat.pollVotedSummary(voted, participantCount),
                style: theme.bodyMedium?.copyWith(color: palette.textSecondary),
              ),
            ],
          ),
        ),
        if (voted == 0)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.screenHorizontal,
              vertical: ViroSpacing.lg,
            ),
            child: Text(
              AppCopy.chat.pollNoVotesYet,
              style: theme.bodyMedium?.copyWith(color: palette.textSecondary),
            ),
          )
        else
          for (final option in message.pollOptions) ...[
            _OptionSectionHeader(
              label: option.text,
              voteCount: message.pollVotes[option.id]?.length ?? 0,
            ),
            for (final uid in message.pollVotes[option.id] ?? const <String>[])
              PollVoterListTile(
                displayName: _nameFor(uid),
                member: memberByUid[uid],
                voteTime: message.pollVoteTimes[uid],
              ),
          ],
      ],
    );
  }
}

class _OptionSectionHeader extends StatelessWidget {
  const _OptionSectionHeader({required this.label, required this.voteCount});

  final String label;
  final int voteCount;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.md,
        ViroSpacing.screenHorizontal,
        ViroSpacing.xs,
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: theme.titleSmall?.copyWith(
                color: palette.brandText,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.sm,
              vertical: ViroSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: palette.accentSoft,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              AppCopy.chat.pollOptionVotesLabel(voteCount),
              style: theme.labelSmall?.copyWith(
                color: palette.accent,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
