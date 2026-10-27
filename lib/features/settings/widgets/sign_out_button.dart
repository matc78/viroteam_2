import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';

/// Bouton texte discret « Se déconnecter » (bas du hub paramètres), avec
/// confirmation.
class SignOutButton extends ConsumerStatefulWidget {
  const SignOutButton({super.key});

  @override
  ConsumerState<SignOutButton> createState() => _SignOutButtonState();
}

class _SignOutButtonState extends ConsumerState<SignOutButton> {
  bool _signingOut = false;

  /// Demande confirmation puis déconnecte l'utilisateur.
  Future<void> _confirmSignOut() async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppCopy.settings.signOut),
        content: Text(AppCopy.settings.signOutDialogBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(AppCopy.common.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(AppCopy.settings.signOut),
          ),
        ],
      ),
    );

    if (accepted != true || !mounted) return;

    setState(() => _signingOut = true);
    try {
      await ref
          .read(pushNotificationServiceProvider)
          .unregisterCurrentToken();
      await ref.read(authServiceProvider).signOut();
      if (mounted) context.go(AppRoutes.entry);
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.settings.signOutFailed);
      }
    } finally {
      if (mounted) setState(() => _signingOut = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;

    return Center(
      child: TextButton.icon(
        onPressed: _signingOut ? null : _confirmSignOut,
        style: TextButton.styleFrom(foregroundColor: palette.textSecondary),
        icon: _signingOut
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : ViroIcon(ViroIcons.logout, size: 18, color: palette.textSecondary),
        label: Text(AppCopy.settings.signOut),
      ),
    );
  }
}
