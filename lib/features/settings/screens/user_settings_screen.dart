import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/settings/providers/theme_mode_provider.dart';
import 'package:viro_team_v2/features/settings/widgets/settings_section_header.dart';
import 'package:viro_team_v2/features/settings/widgets/sign_out_button.dart';
import 'package:viro_team_v2/features/settings/widgets/user_settings_avatar.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/widgets/common/viro_app_version_label.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/club_list_tile.dart';
import 'package:viro_team_v2/widgets/lists/settings_list_tile.dart';

/// Hub paramètres utilisateur : profil, catégories (sous-pages), clubs,
/// puis déconnexion discrète en bas.
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
    final palette = context.viroPalette;
    final userAsync = ref.watch(viroUserProvider);
    final clubsAsync = ref.watch(userClubsProvider);
    final themeMode = ref.watch(themeModeProvider);
    final theme = Theme.of(context).textTheme;

    return ViroScaffold(
      fallbackRoute: AppRoutes.home,
      appBar: ViroAppBar(
        fallbackRoute: AppRoutes.home,
        title: Text(AppCopy.settings.screenTitle),
      ),
      body: userAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ViroErrorState(
          message: AppCopy.settings.loadProfileError,
          onRetry: () => ref.invalidate(viroUserProvider),
        ),
        data: (user) {
          if (user == null) {
            return ViroEmptyState(message: AppCopy.settings.profileNotFound);
          }

          final displayName = user.displayName.isNotEmpty
              ? user.displayName
              : '${user.firstName} ${user.lastName}'.trim();

          return ViroRefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: ViroRefreshIndicator.scrollPhysics,
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
                                  : AppCopy.settings.myAccount,
                              style: theme.titleMedium?.copyWith(
                                color: palette.brandText,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: ViroSpacing.xs),
                            Text(
                              user.email,
                              style: theme.bodyMedium?.copyWith(
                                color: palette.textSecondary,
                              ),
                            ),
                            if (user.phone != null &&
                                user.phone!.trim().isNotEmpty) ...[
                              const SizedBox(height: ViroSpacing.xs),
                              Text(
                                user.phone!.trim(),
                                style: theme.bodySmall?.copyWith(
                                  color: palette.textSecondary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.lg),
                ViroCard(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.md,
                    vertical: ViroSpacing.xs,
                  ),
                  child: Column(
                    children: [
                      SettingsListTile(
                        title: AppCopy.settings.categoryAccount,
                        subtitle: AppCopy.settings.categoryAccountSubtitle,
                        icon: ViroIcons.user,
                        onTap: () => context.push(AppRoutes.settingsAccount),
                      ),
                      SettingsListTile(
                        title: AppCopy.settings.categoryNotifications,
                        subtitle:
                            AppCopy.settings.categoryNotificationsSubtitle,
                        icon: ViroIcons.bell,
                        onTap: () =>
                            context.push(AppRoutes.settingsNotifications),
                      ),
                      SettingsListTile(
                        title: AppCopy.settings.categoryAppearance,
                        subtitle: _themeModeLabel(themeMode),
                        icon: ViroIcons.themeSystem,
                        onTap: () =>
                            context.push(AppRoutes.settingsAppearance),
                      ),
                      SettingsListTile(
                        title: AppCopy.settings.categoryPrivacy,
                        subtitle: AppCopy.settings.categoryPrivacySubtitle,
                        icon: ViroIcons.privacy,
                        showDivider: false,
                        onTap: () => context.push(AppRoutes.settingsPrivacy),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
                SettingsSectionHeader(title: AppCopy.settings.myClubs),
                clubsAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(ViroSpacing.md),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (error, _) => ViroEmptyState(
                    message: AppCopy.settings.loadClubsError,
                  ),
                  data: (clubs) {
                    if (clubs.isEmpty) {
                      return ViroEmptyState(
                        message: AppCopy.settings.noClubsYet,
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
                const SignOutButton(),
                const SizedBox(height: ViroSpacing.xs),
                const ViroAppVersionLabel(),
              ],
            ),
          );
        },
      ),
    );
  }

  String _themeModeLabel(ThemeMode mode) => switch (mode) {
        ThemeMode.system => AppCopy.settings.themeSystem,
        ThemeMode.light => AppCopy.settings.themeLight,
        ThemeMode.dark => AppCopy.settings.themeDark,
      };
}
