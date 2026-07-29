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
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/club_list_tile.dart';

/// Profil utilisateur : infos, clubs, déconnexion.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _signingOut = false;

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

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(viroUserProvider);
    final clubsAsync = ref.watch(userClubsProvider);
    final theme = Theme.of(context).textTheme;

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

          return ListView(
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
                          club: entry.$1,
                          membership: entry.$2,
                          onTap: () => context.push(
                            AppRoutes.clubDetailPath(entry.$1.id),
                          ),
                        ),
                    ],
                  );
                },
              ),
              const SizedBox(height: ViroSpacing.xl),
              ViroPrimaryButton(
                label: 'Se déconnecter',
                outlined: true,
                isLoading: _signingOut,
                onPressed: _signingOut ? null : _signOut,
              ),
            ],
          );
        },
      ),
    );
  }
}
