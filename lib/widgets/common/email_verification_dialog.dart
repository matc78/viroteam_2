import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

/// Intervalle de vérification silencieuse tant que le dialog est ouvert.
const _verificationPollInterval = Duration(seconds: 4);

/// Demande de confirmer l'adresse e-mail avant d'accepter une invitation.
///
/// Envoie le lien de confirmation dès l'ouverture, puis détecte tout seul la
/// confirmation (retour dans l'app + vérification périodique) ; « C'est fait »
/// reste disponible pour forcer la vérification.
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
  bool _sending = false;
  bool _checking = false;
  bool _closed = false;
  String? _message;
  Timer? _pollTimer;
  late final AppLifecycleListener _lifecycleListener;

  @override
  void initState() {
    super.initState();
    _lifecycleListener = AppLifecycleListener(onResume: _checkSilently);
    _pollTimer = Timer.periodic(
      _verificationPollInterval,
      (_) => _checkSilently(),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _send());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _lifecycleListener.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!mounted) return;
    setState(() {
      _sending = true;
      _message = null;
    });
    try {
      await ref.read(accountServiceProvider).sendEmailVerification();
      if (!mounted) return;
      setState(() => _message = AppCopy.join.verifyEmailSent);
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      setState(
        () => _message = error.code == 'too-many-requests'
            ? AppCopy.join.verifyEmailRecentlySent
            : AppCopy.join.verifyEmailSendFailed,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = AppCopy.join.verifyEmailSendFailed);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  /// Ferme le dialog avec succès (une seule fois).
  void _close() {
    if (_closed || !mounted) return;
    _closed = true;
    _pollTimer?.cancel();
    Navigator.pop(context, true);
  }

  /// Vérification en arrière-plan : aucune erreur affichée, ferme si confirmé.
  Future<void> _checkSilently() async {
    if (_checking || _busy || _closed) return;
    _checking = true;
    try {
      final verified =
          await ref.read(accountServiceProvider).refreshEmailVerified();
      if (verified) _close();
    } catch (_) {
      // Réseau indisponible : la prochaine vérification réessaiera.
    } finally {
      _checking = false;
    }
  }

  Future<void> _checkVerified() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    var verified = false;
    try {
      verified = await ref.read(accountServiceProvider).refreshEmailVerified();
    } catch (_) {
      verified = false;
    }
    if (!mounted) return;
    if (verified) {
      _close();
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
    final disabled = _busy || _sending;
    return AlertDialog(
      title: Text(AppCopy.join.verifyEmailTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(AppCopy.join.verifyEmailBody(widget.email)),
          if (message != null) ...[
            const SizedBox(height: ViroSpacing.sm),
            Semantics(
              liveRegion: true,
              child: Text(
                message,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: palette.textSecondary),
              ),
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
          onPressed: disabled ? null : _send,
          child: Text(
            _sending
                ? AppCopy.join.verifyEmailSending
                : AppCopy.join.verifyEmailResend,
          ),
        ),
        FilledButton(
          onPressed: disabled ? null : _checkVerified,
          child: Text(AppCopy.join.verifyEmailDone),
        ),
      ],
    );
  }
}
