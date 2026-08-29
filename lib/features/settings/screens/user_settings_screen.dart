import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/settings/widgets/account_session_section.dart';
import 'package:viro_team_v2/features/settings/widgets/change_email_sheet.dart';
import 'package:viro_team_v2/features/settings/widgets/change_password_sheet.dart';
import 'package:viro_team_v2/features/settings/widgets/edit_profile_sheet.dart';
import 'package:viro_team_v2/features/settings/widgets/user_settings_avatar.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/services/account_service.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/club_list_tile.dart';
import 'package:viro_team_v2/widgets/lists/settings_list_tile.dart';

/// Hub paramètres utilisateur : compte, clubs, légal, session.
class UserSettingsScreen extends ConsumerStatefulWidget {
  const UserSettingsScreen({super.key});

  @override
  ConsumerState<UserSettingsScreen> createState() =>
      _UserSettingsScreenState();
}

class _UserSettingsScreenState extends ConsumerState<UserSettingsScreen> {
  bool _avatarBusy = false;

  Future<void> _refresh() async {
    await Future.wait([
      ref.refresh(viroUserProvider.future),
      ref.refresh(userClubsProvider.future),
    ]);
  }

  Future<void> _changeAvatar(ViroUser user) async {
    setState(() => _avatarBusy = true);
    await pickAndUploadUserAvatar(context, ref, user: user);
    if (mounted) setState(() => _avatarBusy = false);
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(viroUserProvider);
    final clubsAsync = ref.watch(userClubsProvider);
    final theme = Theme.of(context).textTheme;
    final firebaseUser = ref.watch(authStateProvider).value;
    final passwordAccount = firebaseUser != null &&
        AccountService.userHasPasswordProvider(firebaseUser);
    final providerLabels = firebaseUser != null
        ? AccountService.authProviderLabels(firebaseUser)
        : const <String>[];

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
        title: const Text('Paramètres'),
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
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(ViroSpacing.lg),
              children: [
                ViroCard(
                  child: Row(
                    children: [
                      UserSettingsAvatar(
                        displayName: displayName.isNotEmpty
                            ? displayName
                            : user.email,
                        avatarUrl: user.avatarUrl,
                        busy: _avatarBusy,
                        onTap: () => _changeAvatar(user),
                      ),
                      const SizedBox(width: ViroSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              displayName.isNotEmpty
                                  ? displayName
                                  : 'Mon compte',
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
                            if (user.phone != null &&
                                user.phone!.trim().isNotEmpty) ...[
                              const SizedBox(height: ViroSpacing.xs),
                              Text(
                                user.phone!.trim(),
                                style: theme.bodySmall?.copyWith(
                                  color: ViroColors.gray600,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
                Text(
                  'Mon compte',
                  style: theme.titleSmall?.copyWith(
                    color: ViroColors.primary800,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  'Avatar, identité et sécurité de ton compte ViroTeam.',
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
                        title: 'Modifier le profil',
                        icon: ViroIcons.edit,
                        onTap: () => showEditProfileSheet(context, user: user),
                      ),
                      SettingsListTile(
                        title: 'E-mail',
                        subtitle: user.email,
                        icon: ViroIcons.envelope,
                        onTap: () => showChangeEmailSheet(
                          context,
                          user: user,
                          passwordAccount: passwordAccount,
                        ),
                      ),
                      if (passwordAccount)
                        SettingsListTile(
                          title: 'Mot de passe',
                          icon: ViroIcons.key,
                          onTap: () => showChangePasswordSheet(context),
                        ),
                      SettingsListTile(
                        title: 'Type de connexion',
                        subtitle: providerLabels.join(' · '),
                        showDivider: false,
                        trailing: const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.md,
                    vertical: ViroSpacing.xs,
                  ),
                  child: Column(
                    children: [
                      SettingsListTile(
                        title: 'Conditions générales',
                        onTap: () =>
                            openPortalUrl(portalPageUrl('/legal/cgu')),
                      ),
                      SettingsListTile(
                        title: 'Confidentialité',
                        onTap: () =>
                            openPortalUrl(portalPageUrl('/legal/privacy')),
                      ),
                      SettingsListTile(
                        title: 'Mentions légales',
                        showDivider: false,
                        onTap: () =>
                            openPortalUrl(portalPageUrl('/legal/mentions')),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
                const AccountSessionSection(),
              ],
            ),
          );
        },
      ),
    );
  }
}
