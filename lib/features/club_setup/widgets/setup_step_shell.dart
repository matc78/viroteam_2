import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Conteneur centré pour une étape du wizard création club.
class SetupStepShell extends StatelessWidget {
  const SetupStepShell({
    super.key,
    this.title,
    this.subtitle,
    required this.child,
    this.footer,
    this.scrollable = false,
  });

  final String? title;
  final String? subtitle;
  final Widget child;
  final Widget? footer;

  /// `true` uniquement si le contenu peut dépasser (ex. liste longue).
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    final content = Column(
      mainAxisAlignment: MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (title != null) ...[
          Text(
            title!,
            textAlign: TextAlign.center,
            style: theme.titleLarge?.copyWith(
              color: ViroColors.primary800,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: subtitle != null ? ViroSpacing.xs : ViroSpacing.sm),
        ],
        if (subtitle != null) ...[
          Text(
            subtitle!,
            textAlign: TextAlign.center,
            style: theme.bodySmall?.copyWith(
              color: ViroColors.gray600,
              height: 1.35,
            ),
          ),
          const SizedBox(height: ViroSpacing.sm),
        ],
        if (scrollable)
          Flexible(child: child)
        else
          Expanded(child: child),
        if (footer != null) ...[
          const SizedBox(height: ViroSpacing.sm),
          footer!,
        ],
      ],
    );

    return Padding(
      padding: EdgeInsets.fromLTRB(
        ViroSpacing.lg,
        title == null ? ViroSpacing.lg : ViroSpacing.md,
        ViroSpacing.lg,
        ViroSpacing.xs,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: scrollable
              ? SingleChildScrollView(
                  child: content,
                )
              : content,
        ),
      ),
    );
  }
}

/// Paragraphe justifié pour les étapes du wizard.
class SetupJustifiedText extends StatelessWidget {
  const SetupJustifiedText(this.text, {super.key, this.style});

  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: TextAlign.justify,
      style: style ??
          Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: ViroColors.gray600,
                height: 1.5,
              ),
    );
  }
}
