import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/chat/widgets/new_conversation_sheet.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/conversation_list_tile.dart';

/// Liste multi-clubs des conversations.
class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inboxAsync = ref.watch(chatInboxProvider);
    final states = ref.watch(chatStatesProvider).value ?? const {};
    final clubs = ref.watch(userClubsProvider).value ?? const [];
    final clubById = {for (final e in clubs) e.club.id: e.club};
    final isAdminSomewhere = clubs.any(
      (e) => e.membership?.role == MemberRoles.admin,
    );

    return ViroScaffold(
      appBar: ViroAppBar(
        title: Text(AppCopy.chat.conversationsTitle),
        actions: [
          if (isAdminSomewhere)
            IconButton(
              tooltip: AppCopy.chat.createCategoryChannel,
              icon: ViroIcon(ViroIcons.add, color: ViroColors.primary600),
              onPressed: () => _createCategoryChannel(context, ref),
            ),
          IconButton(
            tooltip: AppCopy.chat.newConversation,
            icon: ViroIcon(ViroIcons.chat, color: ViroColors.primary600),
            onPressed: () => showNewConversationSheet(context, ref),
          ),
        ],
      ),
      body: inboxAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(child: Text(AppCopy.chat.loadError)),
        data: (conversations) {
          if (conversations.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(ViroSpacing.lg),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      AppCopy.chat.emptyInbox,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: ViroSpacing.sm),
                    Text(
                      AppCopy.chat.emptyInboxHint,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: ViroColors.gray600,
                          ),
                    ),
                  ],
                ),
              ),
            );
          }
          return ListView.separated(
            itemCount: conversations.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final conv = conversations[index];
              final club = clubById[conv.clubId];
              final stateId = ChatUserState.docId(conv.clubId, conv.id);
              return ConversationListTile(
                conversation: conv,
                clubName: club?.name ?? conv.clubId,
                clubColor: clubAccentColor(
                  brandColorHex: club?.brandColorHex,
                  clubId: conv.clubId,
                ),
                state: states[stateId],
                onTap: () => context.push(
                  AppRoutes.conversationPath(conv.clubId, conv.id),
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showNewConversationSheet(context, ref),
        backgroundColor: ViroColors.primary600,
        child: ViroIcon(ViroIcons.add, color: ViroColors.white),
      ),
    );
  }

  Future<void> _createCategoryChannel(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final clubs = ref.read(userClubsProvider).value ?? const [];
    final adminClubs = clubs
        .where((e) => e.membership?.role == MemberRoles.admin)
        .toList();
    if (adminClubs.isEmpty) return;
    final club = adminClubs.first.club;
    final controller = TextEditingController();
    final keyController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppCopy.chat.createCategoryChannel),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(AppCopy.chat.categoryChannelHint),
            const SizedBox(height: ViroSpacing.sm),
            TextField(
              controller: keyController,
              decoration: InputDecoration(
                labelText: AppCopy.chat.categoryKeyLabel,
              ),
            ),
            TextField(
              controller: controller,
              decoration: InputDecoration(labelText: AppCopy.chat.renameHint),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(AppCopy.common.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(AppCopy.chat.createChannel),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final id = await ref.read(chatServiceProvider).createCategoryChannel(
            clubId: club.id,
            categoryKey: keyController.text.trim(),
            title: controller.text.trim().isEmpty
                ? keyController.text.trim()
                : controller.text.trim(),
          );
      if (!context.mounted) return;
      ViroSnackBar.show(context, AppCopy.chat.channelCreated);
      context.push(AppRoutes.conversationPath(club.id, id));
    } catch (_) {
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.chat.sendFailed);
      }
    }
  }
}
