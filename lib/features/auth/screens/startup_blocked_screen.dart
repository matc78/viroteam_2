import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/startup_session_gate.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/services/startup_session_failure.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Session Auth ouverte, mais Firestore ou App Check a refusé le démarrage.
///
/// Écran stable (pas de retour sur le chargement). Le code court sert à une
/// capture d'écran ; le détail part dans Crashlytics.
class StartupBlockedScreen extends ConsumerStatefulWidget {
  const StartupBlockedScreen({super.key});

  @override
  ConsumerState<StartupBlockedScreen> createState() =>
      _StartupBlockedScreenState();
}

class _StartupBlockedScreenState extends ConsumerState<StartupBlockedScreen> {
  @override
  void initState() {
    super.initState();
    final failure = StartupSessionGate.blockFailure(
      firestoreAuth: ref.read(firestoreAuthReadyProvider),
      profile: ref.read(viroUserProvider),
    );
    if (failure == null) return;
    StartupSessionFailure.report(failure.error, failure.stackTrace);
  }

  /// Relance la session et autorise un nouveau signalement Crashlytics.
  void _retry() {
    StartupSessionFailure.resetReport();
    ref.invalidate(firestoreAuthReadyProvider);
    ref.invalidate(viroUserProvider);
  }

  @override
  Widget build(BuildContext context) {
    final failure = StartupSessionGate.blockFailure(
      firestoreAuth: ref.watch(firestoreAuthReadyProvider),
      profile: ref.watch(viroUserProvider),
    );
    final label = failure == null
        ? null
        : StartupSessionFailure.shortLabel(failure.error);
    final message = label == null
        ? AppCopy.auth.startupBlockedBody
        : '${AppCopy.auth.startupBlockedBody}\n$label';

    return PopScope(
      canPop: false,
      child: ViroScaffold(
        body: ViroErrorState(message: message, onRetry: _retry),
      ),
    );
  }
}
