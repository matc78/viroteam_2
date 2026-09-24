import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';

/// Sheet de création d’un sondage (groupes / canaux).
///
/// Retourne `true` si le sondage a bien été envoyé.
Future<bool> showCreatePollSheet(
  BuildContext context, {
  required WidgetRef ref,
  required String clubId,
  required String conversationId,
}) async {
  final sent = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: ViroColors.scaffold,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) => _CreatePollSheet(
      clubId: clubId,
      conversationId: conversationId,
    ),
  );
  return sent == true;
}

class _CreatePollSheet extends ConsumerStatefulWidget {
  const _CreatePollSheet({
    required this.clubId,
    required this.conversationId,
  });

  final String clubId;
  final String conversationId;

  @override
  ConsumerState<_CreatePollSheet> createState() => _CreatePollSheetState();
}

class _CreatePollSheetState extends ConsumerState<_CreatePollSheet> {
  final _questionController = TextEditingController();
  final _optionControllers = <TextEditingController>[
    TextEditingController(),
    TextEditingController(),
  ];
  bool _allowMultiple = false;
  bool _busy = false;

  @override
  void dispose() {
    _questionController.dispose();
    for (final controller in _optionControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _addOption() {
    if (_optionControllers.length >= 12) return;
    setState(() => _optionControllers.add(TextEditingController()));
  }

  void _removeOption(int index) {
    if (_optionControllers.length <= 2) return;
    setState(() {
      _optionControllers.removeAt(index).dispose();
    });
  }

  Future<void> _submit() async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null || _busy) return;
    final question = _questionController.text.trim();
    final options = _optionControllers
        .map((c) => c.text.trim())
        .where((t) => t.isNotEmpty)
        .toList();
    if (question.isEmpty || options.length < 2) {
      ViroSnackBar.show(context, AppCopy.chat.pollNeedOptions);
      return;
    }
    final user = ref.read(viroUserProvider).value;
    final clubs = ref.read(userClubsProvider).value ?? const [];
    final membership = clubs
        .where((e) => e.club.id == widget.clubId)
        .map((e) => e.membership)
        .firstOrNull;
    final firstName = (user?.firstName.trim().isNotEmpty == true)
        ? user!.firstName.trim()
        : (user?.displayName.trim().split(RegExp(r'\s+')).firstOrNull ?? '');
    final senderRole = membership?.role ?? 'parent';
    setState(() => _busy = true);
    try {
      await ref.read(chatServiceProvider).sendPollMessage(
            clubId: widget.clubId,
            conversationId: widget.conversationId,
            senderUid: uid,
            question: question,
            optionTexts: options,
            allowMultiple: _allowMultiple,
            senderFirstName: firstName,
            senderRole: senderRole,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.chat.pollFailed);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: ViroSpacing.screenHorizontal,
          right: ViroSpacing.screenHorizontal,
          top: ViroSpacing.md,
          bottom: bottomInset + ViroSpacing.md,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  ViroIcon(ViroIcons.poll, color: ViroColors.primary600),
                  const SizedBox(width: ViroSpacing.xs),
                  Expanded(
                    child: Text(
                      AppCopy.chat.createPoll,
                      style: theme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ViroSpacing.md),
              TextField(
                controller: _questionController,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  labelText: AppCopy.chat.pollQuestionLabel,
                  hintText: AppCopy.chat.pollQuestionHint,
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              for (var i = 0; i < _optionControllers.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _optionControllers[i],
                          textCapitalization: TextCapitalization.sentences,
                          decoration: InputDecoration(
                            labelText:
                                '${AppCopy.chat.pollOptionLabel} ${i + 1}',
                          ),
                        ),
                      ),
                      if (_optionControllers.length > 2)
                        IconButton(
                          onPressed: () => _removeOption(i),
                          icon: ViroIcon(
                            ViroIcons.trash,
                            color: ViroColors.gray400,
                          ),
                        ),
                    ],
                  ),
                ),
              if (_optionControllers.length < 12)
                TextButton.icon(
                  onPressed: _addOption,
                  icon: ViroIcon(ViroIcons.add, color: ViroColors.primary600),
                  label: Text(AppCopy.chat.pollAddOption),
                ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _allowMultiple,
                onChanged: (value) => setState(() => _allowMultiple = value),
                title: Text(AppCopy.chat.pollAllowMultiple),
              ),
              const SizedBox(height: ViroSpacing.sm),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(AppCopy.chat.pollSend),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
