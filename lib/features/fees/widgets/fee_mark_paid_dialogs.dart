import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Demande confirmation avant d'enregistrer un « Marquer payé ».
///
/// Retourne `true` uniquement si l'admin valide explicitement.
Future<bool> showFeeMarkPaidConfirmDialog(
  BuildContext context, {
  required String title,
  required String body,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: Text(AppCopy.common.cancel),
        ),
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: Text(AppCopy.fees.markPaid),
        ),
      ],
    ),
  );
  return confirmed == true;
}

/// Dialog bloquant (non fermable) affichant la progression `done/total`.
class FeeBulkProgressDialog extends StatelessWidget {
  const FeeBulkProgressDialog({
    super.key,
    required this.progress,
    required this.total,
  });

  /// Nombre d'éléments déjà traités.
  final ValueListenable<int> progress;
  final int total;

  /// Ouvre le dialog sans l'attendre ; le fermer via [Navigator.pop] sur le
  /// navigateur racine une fois le traitement terminé.
  static void show(
    BuildContext context, {
    required ValueListenable<int> progress,
    required int total,
  }) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      useRootNavigator: true,
      builder: (_) => FeeBulkProgressDialog(progress: progress, total: total),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AlertDialog(
        content: ValueListenableBuilder<int>(
          valueListenable: progress,
          builder: (context, done, _) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                AppCopy.fees.markPaidProgress(done, total),
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: ViroSpacing.md),
              LinearProgressIndicator(
                value: total > 0 ? done / total : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
