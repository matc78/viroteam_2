import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// État vide réutilisable (listes, sections).
class ViroEmptyState extends StatelessWidget {
  const ViroEmptyState({
    super.key,
    required this.message,
    this.icon,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final IconData? icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(ViroSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ViroIcon(
              icon ?? ViroIcons.users,
              size: 40,
              color: ViroColors.gray400,
            ),
            const SizedBox(height: ViroSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.bodyLarge?.copyWith(color: ViroColors.gray600),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: ViroSpacing.lg),
              ViroPrimaryButton(label: actionLabel!, onPressed: onAction),
            ],
          ],
        ),
      ),
    );
  }
}

/// État d'erreur réutilisable.
class ViroErrorState extends StatelessWidget {
  const ViroErrorState({
    super.key,
    this.message = 'Une erreur est survenue',
    this.onRetry,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(ViroSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ViroIcon(ViroIcons.close, size: 36, color: ViroColors.error),
            const SizedBox(height: ViroSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.bodyLarge?.copyWith(color: ViroColors.gray600),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: ViroSpacing.lg),
              ViroPrimaryButton(
                label: 'Réessayer',
                outlined: true,
                onPressed: onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
