import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';
import 'package:viro_team_v2/services/analytics_service.dart';

/// Événements PostHog du wizard création de club (sans nom, ville ni uid).
class ClubSetupAnalytics {
  ClubSetupAnalytics({required AnalyticsService analytics})
    : _analytics = analytics;

  final AnalyticsService _analytics;

  static const String startedEvent = 'club_setup_started';
  static const String stepViewedEvent = 'club_setup_step_viewed';
  static const String completedEvent = 'club_setup_completed';

  /// Signale l'ouverture du wizard ([resumed] si un brouillon local existait).
  void trackStarted({required bool resumed, required int initialStep}) {
    _analytics.capture(startedEvent, {
      'wizard_version': ClubSetupSteps.wizardVersion,
      'resumed': resumed,
      'initial_step': ClubSetupSteps.analyticsKey(initialStep),
    });
  }

  /// Signale l'affichage d'une étape (navigation avant / arrière comprise).
  void trackStepViewed(int step) {
    final stepIndex = ClubSetupSteps.clampIndex(step);
    _analytics.capture(stepViewedEvent, {
      'wizard_version': ClubSetupSteps.wizardVersion,
      'step': ClubSetupSteps.analyticsKey(stepIndex),
      'step_index': stepIndex,
    });
  }

  /// Signale une création de club réussie (choix questionnaire uniquement).
  void trackCompleted({
    required String sport,
    required Set<String> objectives,
    String? memberCountRange,
  }) {
    final sortedObjectives = objectives.toList()..sort();
    _analytics.capture(completedEvent, {
      'wizard_version': ClubSetupSteps.wizardVersion,
      'sport': sport,
      'objectives': sortedObjectives,
      'objective_count': sortedObjectives.length,
      if (memberCountRange != null && memberCountRange.isNotEmpty)
        'member_count_range': memberCountRange,
    });
  }
}
