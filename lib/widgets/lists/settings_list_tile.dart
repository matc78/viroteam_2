import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';

/// Tuile standard pour les listes de paramètres (icône, titre, chevron).
class SettingsListTile extends StatelessWidget {
  const SettingsListTile({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.onTap,
    this.showDivider = true,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final VoidCallback? onTap;
  final bool showDivider;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: icon != null
              ? ViroIcon(icon!, color: ViroColors.primary800, size: 22)
              : null,
          title: Text(title),
          subtitle: subtitle != null
              ? Text(
                  subtitle!,
                  style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
                )
              : null,
          trailing: trailing ??
              (onTap != null
                  ? ViroIcon(ViroIcons.chevronRight, color: ViroColors.gray600)
                  : null),
          onTap: onTap,
        ),
        if (showDivider) const Divider(height: 1),
      ],
    );
  }
}
