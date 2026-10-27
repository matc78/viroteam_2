import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

/// Demande de confirmer l'adresse e-mail avant d'accepter une invitation.
///
/// Envoie le lien de confirmation, puis vérifie au tap « C'est fait ».
/// Retourne `true` si l'adresse est confirmée (l'appelant relance l'action).
Future<bool> showEmailVerificationDialog({
  required BuildContext context,
  required String email,
}) async {
  final verified = await showDialog<bool>(
    context: context,
    builder: (ctx) => Theme(
      data: Theme.of(context),
      child: _EmailVerificationDialog(email: email),
    ),
  );
  return verified == true;
}

class _EmailVerificationDialog extends ConsumerStatefulWidget {
  const _EmailVerificationDialog({required this.email});

  final String email;

  @override
  ConsumerState<_EmailVerificationDialog> createState() =>
      _EmailVerificationDialogState();
}

class _EmailVerificationDialogState
    extends ConsumerState<_EmailVerificationDialog> {
  bool _busy = false;
  bool _sent = false;
  String? _message;

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await ref.read(accountServiceProvider).sendEmailVerification();
      if (!mounted) return;
      setState(() {
        _sent = true;
        _message = AppCopy.join.verifyEmailSent;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = AppCopy.join.verifyEmailSendFailed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkVerified() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    final verified =
        await ref.read(accountServiceProvider).refreshEmailVerified();
    if (!mounted) return;
    if (verified) {
      Navigator.pop(context, true);
      return;
    }
    setState(() {
      _busy = false;
      _message = AppCopy.join.verifyEmailStillPending;
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final message = _message;
    return AlertDialog(
      title: Text(AppCopy.join.verifyEmailTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(AppCopy.join.verifyEmailBody(widget.email)),
          if (message != null) ...[
            const SizedBox(height: ViroSpacing.sm),
            Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: palette.textSecondary),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context, false),
          child: Text(AppCopy.common.cancel),
        ),
        TextButton(
          onPressed: _busy ? null : _send,
          child: Text(
            _sent ? AppCopy.join.verifyEmailResend : AppCopy.join.verifyEmailSend,
          ),
        ),
        FilledButton(
          onPressed: _busy ? null : _checkVerified,
          child: Text(AppCopy.join.verifyEmailDone),
        ),
      ],
    );
  }
}
