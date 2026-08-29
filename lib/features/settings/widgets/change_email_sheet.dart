import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/auth_error_message.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Ouvre le formulaire de changement d’e-mail.
Future<bool?> showChangeEmailSheet(
  BuildContext context, {
  required ViroUser user,
  required bool passwordAccount,
}) {
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
      child: _ChangeEmailSheet(
        user: user,
        passwordAccount: passwordAccount,
      ),
    ),
  );
}

class _ChangeEmailSheet extends ConsumerStatefulWidget {
  const _ChangeEmailSheet({
    required this.user,
    required this.passwordAccount,
  });

  final ViroUser user;
  final bool passwordAccount;

  @override
  ConsumerState<_ChangeEmailSheet> createState() => _ChangeEmailSheetState();
}

class _ChangeEmailSheetState extends ConsumerState<_ChangeEmailSheet> {
  late final TextEditingController _emailController;
  late final TextEditingController _passwordController;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.user.email);
    _passwordController = TextEditingController();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final newEmail = _emailController.text.trim();
    if (newEmail.isEmpty) {
      setState(() => _error = 'E-mail requis.');
      return;
    }
    if (!newEmail.contains('@')) {
      setState(() => _error = 'E-mail invalide.');
      return;
    }
    if (newEmail == widget.user.email.trim()) {
      Navigator.of(context).pop(false);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(accountServiceProvider).changeEmail(
            newEmail: newEmail,
            currentPassword: widget.passwordAccount
                ? _passwordController.text
                : null,
          );
      if (mounted) {
        ViroSnackBar.show(
          context,
          'E-mail de vérification envoyé. Profil mis à jour.',
        );
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
                    'Changer l’e-mail',
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
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(labelText: 'Nouvel e-mail'),
              enabled: !_saving,
            ),
            if (widget.passwordAccount) ...[
              const SizedBox(height: ViroSpacing.sm),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Mot de passe actuel',
                ),
                enabled: !_saving,
              ),
            ] else
              Padding(
                padding: const EdgeInsets.only(top: ViroSpacing.sm),
                child: Text(
                  'Une fenêtre Google s’ouvrira pour confirmer le changement.',
                  style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
                ),
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
