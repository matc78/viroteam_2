import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/chat/widgets/new_conversation_sheet.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/chat_service.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_floating_icon_button.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/conversation_list_tile.dart';

/// Hauteur du fondu bas (contenu qui disparaît doucement).
const double _kBottomFadeHeight = 56;

/// Liste multi-clubs des conversations.
class ConversationsScreen extends ConsumerStatefulWidget {
  const ConversationsScreen({super.key});

  @override
  ConsumerState<ConversationsScreen> createState() =>
      _ConversationsScreenState();
}

class _ConversationsScreenState extends ConsumerState<ConversationsScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() => _query = _searchController.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _matchesQuery(
    ChatConversation conv, {
    required String clubName,
    String? peerDisplayName,
  }) {
    if (_query.isEmpty) return true;
    final haystack = [
      conv.displayTitle(peerDisplayName: peerDisplayName),
      clubName,
      conv.lastMessagePreview,
      conv.lastSenderFirstName ?? '',
    ].join(' ').toLowerCase();
    return haystack.contains(_query);
  }

  /// Relance les streams inbox / états pour le pull-to-refresh.
  Future<void> _refreshInbox() async {
    ref.invalidate(chatInboxProvider);
    ref.invalidate(chatStatesProvider);
    ref.invalidate(chatPreviewSendersProvider);
    ref.invalidate(chatDmPeerTitlesProvider);
    await ref.read(chatInboxProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(authStateProvider).value?.uid;
    final inboxAsync = ref.watch(chatInboxProvider);
    final states = ref.watch(chatStatesProvider).value ?? const {};
    final clubs = ref.watch(userClubsProvider).value ?? const [];
    final clubById = {for (final e in clubs) e.club.id: e.club};
    final clubRoleById = <String, ViroRole>{};
    for (final entry in clubs) {
      final role = viroRoleForClubSession(
        memberRole: entry.membership?.role,
        hasFamilyLinks: entry.hasFamilyLinks,
      );
      if (role != null) clubRoleById[entry.club.id] = role;
    }
    final previewSenders =
        ref.watch(chatPreviewSendersProvider).value ?? const {};
    final dmPeerTitles =
        ref.watch(chatDmPeerTitlesProvider).value ?? const {};
    final isAdminSomewhere = clubs.any(
      (e) => e.membership?.role == MemberRoles.admin,
    );

    return ViroScaffold(
      appBar: ViroAppBar(
        title: Text(AppCopy.chat.conversationsTitle),
        actions: [
          if (isAdminSomewhere)
            Padding(
              padding: const EdgeInsets.only(right: ViroSpacing.sm),
              child: Center(
                child: ViroFloatingIconButton(
                  circular: true,
                  icon: ViroIcons.megaphone,
                  tooltip: AppCopy.chat.createCategoryChannel,
                  backgroundColor: ViroColors.gray100,
                  foregroundColor: ViroColors.primary800,
                  onPressed: () => _createCategoryChannel(context, ref),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(right: ViroSpacing.screenHorizontal),
            child: Center(
              child: ViroFloatingIconButton(
                circular: true,
                icon: ViroIcons.add,
                tooltip: AppCopy.chat.newConversation,
                backgroundColor: ViroColors.primary600,
                foregroundColor: ViroColors.white,
                onPressed: () => showNewConversationSheet(context, ref),
              ),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          inboxAsync.when(
            loading: () => const Center(child: ViroLogoLoader()),
            error: (_, __) => ViroErrorState(
              message: AppCopy.chat.loadError,
              onRetry: () {
                _refreshInbox();
              },
            ),
            data: (conversations) {
              if (conversations.isEmpty) {
                return ViroEmptyState(
                  message: AppCopy.chat.emptyInbox,
                  icon: ViroIcons.chat,
                  actionLabel: AppCopy.chat.newConversation,
                  onAction: () => showNewConversationSheet(context, ref),
                );
              }

              final sorted = ChatService.sortInboxConversations(
                conversations,
                states,
              );
              final filtered = sorted.where((conv) {
                final club = clubById[conv.clubId];
                final peerName = dmPeerTitles['${conv.clubId}|${conv.id}'];
                return _matchesQuery(
                  conv,
                  clubName: club?.name ?? conv.clubId,
                  peerDisplayName: peerName,
                );
              }).toList();

              return ViroRefreshIndicator(
                onRefresh: _refreshInbox,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          ViroSpacing.screenHorizontal,
                          ViroSpacing.sm,
                          ViroSpacing.screenHorizontal,
                          ViroSpacing.sm,
                        ),
                        child: TextField(
                          controller: _searchController,
                          decoration: InputDecoration(
                            hintText: AppCopy.chat.searchConversationsHint,
                            prefixIcon: ViroIcon(
                              ViroIcons.search,
                              color: ViroColors.gray400,
                            ),
                            filled: true,
                            fillColor: ViroColors.gray100,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(999),
                              borderSide: BorderSide.none,
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(999),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(999),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: ViroSpacing.md,
                              vertical: ViroSpacing.sm + 2,
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (filtered.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: ViroEmptyState(
                          message: AppCopy.chat.searchNoResults,
                          icon: ViroIcons.search,
                        ),
                      )
                    else
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final conv = filtered[index];
                            final club = clubById[conv.clubId];
                            final stateId =
                                ChatUserState.docId(conv.clubId, conv.id);
                            final senderUid = conv.lastSenderUid;
                            final resolved = senderUid == null
                                ? null
                                : previewSenders['${conv.clubId}|$senderUid'];
                            return ConversationListTile(
                              conversation: conv,
                              clubName: club?.name ?? conv.clubId,
                              clubColor: clubAccentColor(
                                brandColorHex: club?.brandColorHex,
                                clubId: conv.clubId,
                              ),
                              clubRole: clubRoleById[conv.clubId],
                              state: states[stateId],
                              viewerUid: uid,
                              previewFirstName: resolved?.firstName,
                              previewSenderRole: resolved?.role,
                              peerDisplayName:
                                  dmPeerTitles['${conv.clubId}|${conv.id}'],
                              onTap: () => context.push(
                                AppRoutes.conversationPath(
                                  conv.clubId,
                                  conv.id,
                                ),
                              ),
                            );
                          },
                          childCount: filtered.length,
                        ),
                      ),
                    SliverToBoxAdapter(
                      child: SizedBox(
                        height: _kBottomFadeHeight +
                            MediaQuery.paddingOf(context).bottom,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          // Fade bas léger (pas de voile opaque) — laisse voir le fond Viro.
          if (inboxAsync.hasValue && (inboxAsync.value?.isNotEmpty ?? false))
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: IgnorePointer(
                child: SizedBox(
                  height: _kBottomFadeHeight,
                  width: double.infinity,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          ViroColors.white.withValues(alpha: 0),
                          ViroColors.white.withValues(alpha: 0.55),
                          ViroColors.white.withValues(alpha: 0.85),
                        ],
                        stops: const [0.0, 0.55, 1.0],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
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
