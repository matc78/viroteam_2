import 'package:url_launcher/url_launcher.dart';
import 'package:viro_team_v2/config/project_config.dart';

/// Construit une URL vers une page du portail web (bureau / famille).
Uri portalPageUrl(String path, {String? clubId}) {
  final normalizedPath = path.startsWith('/') ? path : '/$path';
  var base = ProjectConfig.portalBaseUrl;
  if (base.endsWith('/')) {
    base = base.substring(0, base.length - 1);
  }
  final uri = Uri.parse('$base$normalizedPath');
  if (clubId == null || clubId.isEmpty) return uri;
  return uri.replace(queryParameters: {'clubId': clubId});
}

/// Accueil dashboard (`/home`).
Uri portalHomeUrl({String? clubId}) => portalPageUrl('/home', clubId: clubId);

/// Configuration cotisations (`/fees`).
Uri portalFeesUrl({required String clubId}) =>
    portalPageUrl('/fees', clubId: clubId);

/// Planning calendrier (`/planning`).
Uri portalPlanningUrl({required String clubId}) =>
    portalPageUrl('/planning', clubId: clubId);

/// Liste membres (`/members`).
Uri portalMembersUrl({required String clubId}) =>
    portalPageUrl('/members', clubId: clubId);

/// Ouvre une URL du portail dans le navigateur externe.
Future<bool> openPortalUrl(Uri url) =>
    launchUrl(url, mode: LaunchMode.externalApplication);
