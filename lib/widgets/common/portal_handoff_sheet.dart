import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Feuille « À faire sur ordinateur » : explique qu’une action se fait sur
/// le portail web et propose d’ouvrir [url] ou de copier le lien (pour le
/// coller sur un ordinateur).
///
/// [title] / [message] décrivent l’action (ex. import CSV des membres).
Future<void> showPortalHandoffSheet(
  BuildContext context, {
  required String title,
  required String message,
  required Uri url,
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: context.viroPalette.surfaceCard,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(ViroSpacing.cardRadius),
      ),
    ),
    builder: (_) =>
        PortalHandoffSheet(title: title, message: message, url: url),
  );
}

/// Contenu de [showPortalHandoffSheet].
class PortalHandoffSheet extends StatelessWidget {
  const PortalHandoffSheet({
    super.key,
    required this.title,
    required this.message,
    required this.url,
  });

  final String title;
  final String message;
  final Uri url;

  /// Ouvre le site ; en cas d’échec (aucun navigateur, exception), ferme la
  /// feuille pour que le message ne reste pas caché dessous.
  Future<void> _open(BuildContext context) async {
    bool opened;
    try {
      opened = await openPortalUrl(url);
    } catch (_) {
      opened = false;
    }
    if (!context.mounted) return;
    Navigator.of(context).pop();
    if (!opened) {
      ViroSnackBar.show(context, AppCopy.common.portalHandoffOpenFailed);
    }
  }

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: url.toString()));
    if (!context.mounted) return;
    Navigator.of(context).pop();
    ViroSnackBar.show(context, AppCopy.common.portalHandoffCopied);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ViroSpacing.lg,
          ViroSpacing.xs,
          ViroSpacing.lg,
          ViroSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                ViroIcon(
                  ViroIcons.desktop,
                  color: palette.readableAccent(palette.accent),
                ),
                const SizedBox(width: ViroSpacing.sm),
                Expanded(
                  child: Text(
                    title,
                    style: theme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: palette.brandText,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              message,
              style: theme.bodyMedium?.copyWith(
                color: palette.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            SelectableText(
              url.toString(),
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
            const SizedBox(height: ViroSpacing.lg),
            // Action principale : copier le lien, à ouvrir sur un ordinateur
            // (l’action renvoyée n’est pas disponible sur un petit écran).
            ViroPrimaryButton(
              label: AppCopy.common.portalHandoffCopy,
              onPressed: () => _copy(context),
            ),
            const SizedBox(height: ViroSpacing.sm),
            ViroPrimaryButton(
              label: AppCopy.common.portalHandoffOpen,
              outlined: true,
              onPressed: () => _open(context),
            ),
          ],
        ),
      ),
    );
  }
}
