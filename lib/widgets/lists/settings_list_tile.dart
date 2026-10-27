import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';

/// Tuile standard pour les listes de paramètres (icône, titre, chevron).
///
/// [destructive] colore icône et titre en rouge (actions définitives).
class SettingsListTile extends StatelessWidget {
  const SettingsListTile({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.onTap,
    this.showDivider = true,
    this.trailing,
    this.destructive = false,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final VoidCallback? onTap;
  final bool showDivider;
  final Widget? trailing;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final foreground = destructive ? palette.errorText : palette.brandText;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          type: MaterialType.transparency,
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: icon != null
                ? ViroIcon(icon!, color: foreground, size: 22)
                : null,
            title: Text(
              title,
              style: destructive
                  ? TextStyle(color: foreground, fontWeight: FontWeight.w600)
                  : null,
            ),
            subtitle: subtitle != null
                ? Text(
                    subtitle!,
                    style: theme.bodySmall?.copyWith(color: palette.textSecondary),
                  )
                : null,
            trailing: trailing ??
                (onTap != null
                    ? ViroIcon(ViroIcons.chevronRight, color: palette.textSecondary)
                    : null),
            onTap: onTap,
          ),
        ),
        if (showDivider) const Divider(height: 1),
      ],
    );
  }
}
