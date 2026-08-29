import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/auth_error_message.dart';
import 'package:viro_team_v2/utils/password_policy.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Ouvre le formulaire de changement de mot de passe.
Future<bool?> showChangePasswordSheet(BuildContext context) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: ViroColors.surfaceCard,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(ViroSpacing.cardRadius),
      ),
    ),
    builder: (sheetContext) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
      ),
      child: const _ChangePasswordSheet(),
    ),
  );
}

class _ChangePasswordSheet extends ConsumerStatefulWidget {
  const _ChangePasswordSheet();

  @override
  ConsumerState<_ChangePasswordSheet> createState() =>
      _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends ConsumerState<_ChangePasswordSheet> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final newPassword = _newController.text;
    final confirmPassword = _confirmController.text;

    final policyError = PasswordPolicy.validate(newPassword);
    if (policyError != null) {
      setState(() => _error = policyError);
      return;
    }
    if (newPassword != confirmPassword) {
      setState(() => _error = 'Les mots de passe ne correspondent pas.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(accountServiceProvider).changePassword(
            currentPassword: _currentController.text,
            newPassword: newPassword,
          );
      if (mounted) {
        ViroSnackBar.show(context, 'Mot de passe mis à jour');
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = AuthErrorMessage.from(e));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

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
                    'Changer le mot de passe',
                    style: theme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: ViroColors.primary800,
                    ),
                  ),
                ),
                IconButton(
                  icon: ViroIcon(ViroIcons.close),
                  onPressed: _saving ? null : () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: ViroSpacing.sm),
            TextField(
              controller: _currentController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Mot de passe actuel',
              ),
              enabled: !_saving,
            ),
            const SizedBox(height: ViroSpacing.sm),
            TextField(
              controller: _newController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Nouveau mot de passe',
                helperText: PasswordPolicy.hint,
                helperMaxLines: 2,
              ),
              enabled: !_saving,
            ),
            const SizedBox(height: ViroSpacing.sm),
            TextField(
              controller: _confirmController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirmer'),
              enabled: !_saving,
            ),
            if (_error != null) ...[
              const SizedBox(height: ViroSpacing.sm),
              Text(
                _error!,
                style: theme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ],
            const SizedBox(height: ViroSpacing.lg),
            ViroPrimaryButton(
              label: 'Enregistrer',
              isLoading: _saving,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
