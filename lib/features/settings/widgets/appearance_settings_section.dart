import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/providers/theme_mode_provider.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/lists/settings_list_tile.dart';

/// Section paramètres : choix du thème (Système / Clair / Sombre).
///
/// [showTitle] à `false` quand l'AppBar porte déjà le titre (sous-page).
class AppearanceSettingsSection extends ConsumerWidget {
  const AppearanceSettingsSection({super.key, this.showTitle = true});

  final bool showTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final selected = ref.watch(themeModeProvider);

    Widget option({
      required ThemeMode mode,
      required String title,
      String? subtitle,
      required IconData icon,
      bool showDivider = true,
    }) {
      final isSelected = selected == mode;
      return Semantics(
        selected: isSelected,
        inMutuallyExclusiveGroup: true,
        child: SettingsListTile(
          title: title,
          subtitle: subtitle,
          icon: icon,
          showDivider: showDivider,
          trailing: ViroIcon(
            isSelected ? ViroIcons.radioOn : ViroIcons.radioOff,
            color: isSelected ? palette.accent : palette.textMuted,
          ),
          onTap: () => ref.read(themeModeProvider.notifier).select(mode),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showTitle) ...[
          Text(
            AppCopy.settings.appearanceSection,
            style: theme.titleSmall?.copyWith(
              color: palette.brandText,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: ViroSpacing.xs),
        ],
        Text(
          AppCopy.settings.appearanceSubtitle,
          style: theme.bodySmall?.copyWith(color: palette.textSecondary),
        ),
        const SizedBox(height: ViroSpacing.sm),
        ViroCard(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.xs,
          ),
          child: Column(
            children: [
              option(
                mode: ThemeMode.system,
                title: AppCopy.settings.themeSystem,
                subtitle: AppCopy.settings.themeSystemSubtitle,
                icon: ViroIcons.themeSystem,
              ),
              option(
                mode: ThemeMode.light,
                title: AppCopy.settings.themeLight,
                icon: ViroIcons.themeLight,
              ),
              option(
                mode: ThemeMode.dark,
                title: AppCopy.settings.themeDark,
                icon: ViroIcons.themeDark,
                showDivider: false,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
