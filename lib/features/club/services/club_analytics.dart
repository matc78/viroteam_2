import 'package:viro_team_v2/services/analytics_service.dart';

/// Événements PostHog de la fiche club (CTA seulement, sans PII).
class ClubAnalytics {
  ClubAnalytics({required AnalyticsService analytics}) : _analytics = analytics;

  final AnalyticsService _analytics;

  static const String actionTappedEvent = 'club_action_tapped';

  static const String zoneShortcut = 'shortcut';
  static const String zoneManagement = 'management';
  static const String zoneFamily = 'family';

  static const String actionPlanning = 'planning';
  static const String actionTeams = 'teams';
  static const String actionAnnouncements = 'announcements';
  static const String actionMyFee = 'my_fee';
  static const String actionMembers = 'members';
  static const String actionActivity = 'activity';
  static const String actionFees = 'fees';
  static const String actionAppearance = 'appearance';
  static const String actionLocations = 'locations';
  static const String actionEquipment = 'equipment';
  static const String actionSettings = 'settings';

  /// Signale un tap sur un CTA de la fiche club.
  ///
  /// [action] et [zone] sont des ids stables ; [role] = rôle session
  /// (`player` / `coach` / `admin` / `parent` / `none`).
  void trackActionTapped({
    required String action,
    required String role,
    required String zone,
  }) {
    _analytics.capture(actionTappedEvent, {
      'action': action,
      'role': role,
      'zone': zone,
    });
  }
}
