import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/auth_error_message.dart';
import 'package:viro_team_v2/utils/email_validation.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Ouvre le formulaire d’envoi du lien « mot de passe oublié ».
Future<bool?> showForgotPasswordSheet(
  BuildContext context, {
  String initialEmail = '',
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
      child: _ForgotPasswordSheet(initialEmail: initialEmail),
    ),
  );
}

class _ForgotPasswordSheet extends ConsumerStatefulWidget {
  const _ForgotPasswordSheet({required this.initialEmail});

  final String initialEmail;

  @override
  ConsumerState<_ForgotPasswordSheet> createState() =>
      _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends ConsumerState<_ForgotPasswordSheet> {
  late final TextEditingController _emailController;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail.trim());
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  /// Envoie le lien de reset ; [user-not-found] → succès neutre (`true`).
  Future<void> _send() async {
    final emailError = requiredEmailError(_emailController.text);
    if (emailError != null) {
      setState(() => _error = emailError);
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
    });

    try {
      await ref.read(authServiceProvider).sendPasswordResetEmail(
            email: _emailController.text,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      final resetError = AuthErrorMessage.forPasswordReset(error);
      if (resetError == null) {
        Navigator.of(context).pop(true);
        return;
      }
      setState(() {
        _error = resetError;
        _sending = false;
      });
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
                    AppCopy.auth.forgotPasswordTitle,
                    style: theme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: ViroColors.primary800,
                    ),
                  ),
                ),
                IconButton(
                  icon: ViroIcon(ViroIcons.close),
                  onPressed: _sending ? null : () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              AppCopy.auth.forgotPasswordHint,
              style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
            ),
            const SizedBox(height: ViroSpacing.md),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) {
                if (!_sending) _send();
              },
              decoration: InputDecoration(
                labelText: AppCopy.auth.emailFieldLabel,
              ),
              enabled: !_sending,
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
              label: AppCopy.auth.forgotPasswordSendAction,
              isLoading: _sending,
              onPressed: _sending ? null : _send,
            ),
          ],
        ),
      ),
    );
  }
}
