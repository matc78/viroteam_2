import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/account_service.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/lists/settings_list_tile.dart';

/// Section déconnexion et suppression de compte (hub paramètres).
class AccountSessionSection extends ConsumerStatefulWidget {
  const AccountSessionSection({super.key});

  @override
  ConsumerState<AccountSessionSection> createState() =>
      _AccountSessionSectionState();
}

class _AccountSessionSectionState extends ConsumerState<AccountSessionSection> {
  bool _signingOut = false;
  bool _deleting = false;

  /// Demande confirmation puis déconnecte l'utilisateur.
  Future<void> _confirmSignOut() async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Se déconnecter'),
        content: const Text(
          'Tu quittes la session sur cet appareil. '
          'Tu pourras te reconnecter à tout moment avec le même compte.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Se déconnecter'),
          ),
        ],
      ),
    );

    if (accepted != true || !mounted) return;

    setState(() => _signingOut = true);
    try {
      await ref.read(authServiceProvider).signOut();
      if (mounted) context.go(AppRoutes.entry);
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, 'Déconnexion impossible');
    } finally {
      if (mounted) setState(() => _signingOut = false);
    }
  }

  /// Demande confirmation puis supprime le compte Auth.
  Future<void> _confirmDeleteAccount() async {
    final accountService = ref.read(accountServiceProvider);
    final firebaseUser = ref.read(authStateProvider).value;
    if (firebaseUser == null) {
      ViroSnackBar.show(context, 'Aucun utilisateur connecté');
      return;
    }

    final needsPassword =
        AccountService.userHasPasswordProvider(firebaseUser);
    final passwordController = TextEditingController();
    var confirmed = false;

    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Supprimer le compte'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Action irréversible. Ton compte Auth sera supprimé. '
                    'Les données club ne sont pas purgées automatiquement.',
                  ),
                  const SizedBox(height: ViroSpacing.md),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: confirmed,
                    onChanged: (value) =>
                        setDialogState(() => confirmed = value ?? false),
                    title: const Text(
                      'Je confirme vouloir supprimer mon compte',
                      style: TextStyle(fontSize: 14),
                    ),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  if (needsPassword) ...[
                    const SizedBox(height: ViroSpacing.sm),
                    TextField(
                      controller: passwordController,
                      obscureText: true,
                      enabled: confirmed,
                      decoration: const InputDecoration(
                        labelText: 'Mot de passe actuel',
                      ),
                    ),
                  ] else
                    const Text(
                      'Une fenêtre Google s’ouvrira pour confirmer.',
                      style: TextStyle(fontSize: 13),
                    ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: const Text('Annuler'),
                ),
                TextButton(
                  onPressed: !confirmed
                      ? null
                      : () => Navigator.of(dialogContext).pop(true),
                  child: Text(
                    'Supprimer',
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ),
              ],
            );
          },
        );
      },
    );

    final password = passwordController.text;
    passwordController.dispose();
    if (accepted != true || !mounted) return;

    setState(() => _deleting = true);
    try {
      await accountService.deleteAccount(
        currentPassword: needsPassword ? password : null,
      );
      if (mounted) context.go(AppRoutes.entry);
    } on AuthCanceledException {
      // Annulation volontaire.
    } on AccountDeletionException catch (error) {
      if (mounted) ViroSnackBar.show(context, error.message);
    } on FirebaseAuthException catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          error.code == 'wrong-password' ||
                  error.code == 'invalid-credential'
              ? 'Mot de passe incorrect'
              : callableErrorMessage(error, fallback: 'Suppression impossible'),
        );
      }
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, 'Suppression impossible');
      }
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final busy = _signingOut || _deleting;
    final errorColor = Theme.of(context).colorScheme.error;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Session',
          style: theme.titleSmall?.copyWith(
            color: ViroColors.primary800,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(
          'Actions sensibles — une confirmation te sera demandée.',
          style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
        ),
        const SizedBox(height: ViroSpacing.sm),
        ViroCard(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.xs,
          ),
          child: Column(
            children: [
              SettingsListTile(
                title: 'Se déconnecter',
                subtitle: 'Quitter la session sur cet appareil',
                icon: ViroIcons.logout,
                onTap: busy ? null : _confirmSignOut,
                trailing: _signingOut
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : null,
              ),
              SettingsListTile(
                title: 'Supprimer mon compte',
                subtitle: 'Action irréversible',
                icon: ViroIcons.trash,
                showDivider: false,
                onTap: busy ? null : _confirmDeleteAccount,
                trailing: _deleting
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: errorColor,
                        ),
                      )
                    : null,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
