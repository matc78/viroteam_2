import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/club_list_tile.dart';

/// Profil utilisateur : infos, clubs, légal, déconnexion, suppression.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _signingOut = false;
  bool _deleting = false;

  /// Déconnecte l'utilisateur et renvoie vers l'entrée.
  Future<void> _signOut() async {
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
    final firebaseUser = FirebaseAuth.instance.currentUser;
    if (firebaseUser == null) {
      ViroSnackBar.show(context, 'Aucun utilisateur connecté');
      return;
    }

    final needsPassword = accountService.hasPasswordProvider(firebaseUser);
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
    final userAsync = ref.watch(viroUserProvider);
    final clubsAsync = ref.watch(userClubsProvider);
    final theme = Theme.of(context).textTheme;
    final busy = _signingOut || _deleting;

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.home);
            }
          },
        ),
        title: const Text('Mon profil'),
      ),
      body: userAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => ViroErrorState(
          message: 'Impossible de charger le profil',
          onRetry: () => ref.invalidate(viroUserProvider),
        ),
        data: (user) {
          if (user == null) {
            return const ViroEmptyState(message: 'Profil introuvable');
          }

          final displayName = user.displayName.isNotEmpty
              ? user.displayName
              : '${user.firstName} ${user.lastName}'.trim();

          return ViroRefreshIndicator(
            onRefresh: () async {
              await Future.wait([
                ref.refresh(viroUserProvider.future),
                ref.refresh(userClubsProvider.future),
              ]);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(ViroSpacing.lg),
              children: [
                ViroCard(
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: ViroColors.primary100,
                        child: ViroIcon(
                          ViroIcons.user,
                          color: ViroColors.primary800,
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: ViroSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              displayName,
                              style: theme.titleMedium?.copyWith(
                                color: ViroColors.primary800,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: ViroSpacing.xs),
                            Text(
                              user.email,
                              style: theme.bodyMedium?.copyWith(
                                color: ViroColors.gray600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.lg),
                Text(
                  'Mes clubs',
                  style: theme.titleSmall?.copyWith(
                    color: ViroColors.primary800,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                clubsAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(ViroSpacing.md),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (_, _) => const ViroEmptyState(
                    message: 'Impossible de charger les clubs',
                  ),
                  data: (clubs) {
                    if (clubs.isEmpty) {
                      return const ViroEmptyState(
                        message: 'Aucun club pour le moment',
                      );
                    }
                    return Column(
                      children: [
                        for (final entry in clubs)
                          ClubListTile(
                            club: entry.club,
                            membership: entry.membership,
                            onTap: () => context.push(
                              AppRoutes.clubDetailPath(entry.club.id),
                            ),
                          ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: ViroSpacing.xl),
                Text(
                  'Légal',
                  style: theme.titleSmall?.copyWith(
                    color: ViroColors.primary800,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroCard(
                  child: Column(
                    children: [
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Conditions générales'),
                        trailing: ViroIcon(ViroIcons.chevronRight),
                        onTap: () =>
                            openPortalUrl(portalPageUrl('/legal/cgu')),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Confidentialité'),
                        trailing: ViroIcon(ViroIcons.chevronRight),
                        onTap: () =>
                            openPortalUrl(portalPageUrl('/legal/privacy')),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Mentions légales'),
                        trailing: ViroIcon(ViroIcons.chevronRight),
                        onTap: () =>
                            openPortalUrl(portalPageUrl('/legal/mentions')),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
                ViroPrimaryButton(
                  label: 'Se déconnecter',
                  outlined: true,
                  isLoading: _signingOut,
                  onPressed: busy ? null : _signOut,
                ),
                const SizedBox(height: ViroSpacing.md),
                TextButton(
                  onPressed: busy ? null : _confirmDeleteAccount,
                  child: _deleting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          'Supprimer mon compte',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
