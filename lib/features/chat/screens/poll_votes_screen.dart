import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/poll_voter_list_tile.dart';

/// Ouvre l’écran détails des votes d’un sondage (layout type infos groupe).
Future<void> openPollVotesScreen({
  required BuildContext context,
  required String clubId,
  required String conversationId,
  required String messageId,
  required int participantCount,
}) {
  return Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => PollVotesScreen(
        clubId: clubId,
        conversationId: conversationId,
        messageId: messageId,
        participantCount: participantCount,
      ),
    ),
  );
}

/// Détails du sondage : question, résumé, votants groupés par option.
class PollVotesScreen extends ConsumerWidget {
  const PollVotesScreen({
    super.key,
    required this.clubId,
    required this.conversationId,
    required this.messageId,
    required this.participantCount,
  });

  final String clubId;
  final String conversationId;
  final String messageId;
  final int participantCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messageAsync = ref.watch(
      chatMessageProvider((
        clubId: clubId,
        conversationId: conversationId,
        messageId: messageId,
      )),
    );
    final members =
        ref.watch(clubMembersProvider(clubId)).value ?? const <ClubMember>[];
    final memberByUid = <String, ClubMember>{
      for (final member in members)
        if (member.accountUid != null && member.accountUid!.isNotEmpty)
          member.accountUid!: member,
    };

    return ViroScaffold(
      appBar: ViroAppBar(
        title: Text(AppCopy.chat.pollDetailsTitle),
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft, color: ViroColors.primary800),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: messageAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Text(
            AppCopy.chat.loadError,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: ViroColors.gray600,
                ),
          ),
        ),
        data: (message) {
          if (message == null || !message.isPoll || message.isDeleted) {
            return Center(
              child: Text(
                AppCopy.chat.pollUnavailable,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: ViroColors.gray600,
                    ),
              ),
            );
          }
          return _PollVotesBody(
            message: message,
            memberByUid: memberByUid,
            participantCount: participantCount,
          );
        },
      ),
    );
  }
}

class _PollVotesBody extends StatelessWidget {
  const _PollVotesBody({
    required this.message,
    required this.memberByUid,
    required this.participantCount,
  });

  final ChatMessage message;
  final Map<String, ClubMember> memberByUid;
  final int participantCount;

  String _nameFor(String uid) {
    final member = memberByUid[uid];
    if (member == null) return AppCopy.chat.pollUnknownVoter;
    final first = member.preferredFirstName.trim();
    if (first.isNotEmpty && first != 'Enfant') return first;
    final display = member.fullName.trim();
    if (display.isNotEmpty) return display.split(RegExp(r'\s+')).first;
    return AppCopy.chat.pollUnknownVoter;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final question = (message.pollQuestion ?? message.text ?? '').trim();
    final voted = message.pollUniqueVoterCount;

    return ListView(
      padding: const EdgeInsets.only(bottom: ViroSpacing.xl),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            ViroSpacing.screenHorizontal,
            ViroSpacing.lg,
            ViroSpacing.screenHorizontal,
            ViroSpacing.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                question,
                style: theme.titleLarge?.copyWith(
                  color: ViroColors.primary800,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                message.pollAllowMultiple
                    ? AppCopy.chat.pollAllowMultiple
                    : AppCopy.chat.pollSingleChoice,
                style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
              ),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                AppCopy.chat.pollVotedSummary(voted, participantCount),
                style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
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
              style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
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
              ),
          ],
      ],
    );
  }
}

class _OptionSectionHeader extends StatelessWidget {
  const _OptionSectionHeader({
    required this.label,
    required this.voteCount,
  });

  final String label;
  final int voteCount;

  @override
  Widget build(BuildContext context) {
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
                color: ViroColors.primary800,
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
              color: ViroColors.primary100,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              AppCopy.chat.pollOptionVotesLabel(voteCount),
              style: theme.labelSmall?.copyWith(
                color: ViroColors.primary600,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
