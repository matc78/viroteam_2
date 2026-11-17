import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/open_chat_thread.dart';
import 'package:viro_team_v2/features/chat/providers/chat_dm_targets_provider.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/chat/chat_dm_targets_service.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/lists/chat_dm_target_list_tile.dart';

/// Sheet : démarrer une discussion avec coaches / admins.
Future<void> showNewConversationSheet(
  BuildContext context,
  WidgetRef ref,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: context.viroPalette.surfaceCard,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(ViroSpacing.cardRadius),
      ),
    ),
    builder: (sheetContext) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
      ),
      child: const _NewConversationSheet(),
    ),
  );
}

class _NewConversationSheet extends ConsumerStatefulWidget {
  const _NewConversationSheet();

  @override
  ConsumerState<_NewConversationSheet> createState() =>
      _NewConversationSheetState();
}

class _NewConversationSheetState extends ConsumerState<_NewConversationSheet> {
  String? _clubId;
  final Set<String> _selected = {};
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final clubs = ref.read(userClubsProvider).value ?? const [];
    if (clubs.isNotEmpty) _clubId = clubs.first.club.id;
  }

  Future<void> _start(List<ChatDmTarget> targets) async {
    final clubId = _clubId;
    if (clubId == null || _selected.isEmpty) return;
    setState(() => _busy = true);
    // Capturer avant pop : le context de la sheet est invalidé ensuite.
    final router = GoRouter.of(context);
    final selectedLabels = targets
        .where((t) => _selected.contains(t.uid))
        .map((t) => t.label)
        .toList();
    final seedTitle = selectedLabels.length == 1
        ? selectedLabels.first
        : selectedLabels.join(', ');
    try {
      // createCoachDm est idempotent (systemKey dm:…) — ouvre la DM existante.
      final conversationId =
          await ref.read(chatServiceProvider).createCoachDm(
                clubId: clubId,
                targetUids: _selected.toList(),
              );
      if (!mounted) return;
      Navigator.of(context).pop();
      final clubs = ref.read(userClubsProvider).value ?? const [];
      final club =
          clubs.where((e) => e.club.id == clubId).map((e) => e.club).firstOrNull;
      openChatThread(
        context,
        ref,
        clubId: clubId,
        conversationId: conversationId,
        title: seedTitle.isNotEmpty
            ? seedTitle
            : AppCopy.chat.conversationsTitle,
        clubColor: clubAccentColor(
          brandColorHex: club?.brandColorHex,
          clubId: clubId,
        ),
        isGroup: _selected.length > 1,
        router: router,
      );
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          callableErrorMessage(error, fallback: AppCopy.chat.sendFailed),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubs = ref.watch(userClubsProvider).value ?? const [];
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final clubId = _clubId;
    final targetsAsync = clubId == null
        ? const AsyncValue<List<ChatDmTarget>>.data([])
        : ref.watch(chatDmTargetsProvider(clubId));
    final targets = targetsAsync.value ?? const <ChatDmTarget>[];
    final loadingTargets = targetsAsync.isLoading;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ViroSpacing.lg,
          ViroSpacing.md,
          ViroSpacing.lg,
          ViroSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    AppCopy.chat.newConversation,
                    style: theme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: palette.brandText,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: AppCopy.common.close,
                  icon: ViroIcon(ViroIcons.close),
                  onPressed: _busy ? null : () => Navigator.pop(context),
                ),
              ],
            ),
            Text(
              AppCopy.chat.newConversationHint,
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
            const SizedBox(height: ViroSpacing.md),
            if (clubs.length > 1)
              DropdownButtonFormField<String>(
                initialValue: _clubId,
                items: clubs
                    .map(
                      (e) => DropdownMenuItem(
                        value: e.club.id,
                        child: Text(e.club.name),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() {
                    _clubId = value;
                    _selected.clear();
                  });
                },
              ),
            if (clubs.length == 1)
              InputDecorator(
                decoration: const InputDecoration(isDense: true),
                child: Text(clubs.first.club.name),
              ),
            const SizedBox(height: ViroSpacing.sm),
            if (loadingTargets)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: ViroSpacing.lg),
                child: Center(child: ViroLogoLoader(size: 36)),
              )
            else if (targets.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: ViroSpacing.md),
                child: Text(
                  AppCopy.chat.noTargets,
                  style: theme.bodyMedium?.copyWith(
                    color: palette.textSecondary,
                  ),
                ),
              )
            else
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: targets.length,
                  itemBuilder: (_, index) {
                    final target = targets[index];
                    return ChatDmTargetListTile(
                      label: target.label,
                      role: target.role,
                      member: target.member,
                      selected: _selected.contains(target.uid),
                      onChanged: (value) => setState(() {
                        if (value) {
                          _selected.add(target.uid);
                        } else {
                          _selected.remove(target.uid);
                        }
                      }),
                    );
                  },
                ),
              ),
            const SizedBox(height: ViroSpacing.lg),
            ViroPrimaryButton(
              label: AppCopy.chat.startChat,
              isLoading: _busy,
              onPressed: _busy || _selected.isEmpty || loadingTargets
                  ? null
                  : () => _start(targets),
            ),
          ],
        ),
      ),
    );
  }
}
