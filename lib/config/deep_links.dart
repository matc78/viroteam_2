import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/providers/session_provider.dart';

/// Parse un deep link `viroteam://…` en route GoRouter.
String? deepLinkRouteFromUri(Uri uri) {
  final host = uri.host.toLowerCase();
  final path = uri.path.replaceFirst(RegExp(r'^/'), '');

  // Join (legacy)
  final isJoinHost = host == 'join';
  final isJoinPath = path == 'join';
  if (isJoinHost || isJoinPath) {
    final code = uri.queryParameters['code']?.trim();
    if (code == null || code.isEmpty) return AppRoutes.join;
    return '${AppRoutes.join}?code=${Uri.encodeQueryComponent(code)}';
  }

  final clubId = uri.queryParameters['clubId']?.trim() ?? '';

  if (host == 'planning' || path == 'planning') {
    final date = uri.queryParameters['date']?.trim() ?? '';
    if (clubId.isEmpty) {
      return AppRoutes.memberPlanning;
    }
    final base = AppRoutes.clubPlanningPath(clubId);
    if (date.isEmpty) return base;
    return '$base?date=${Uri.encodeQueryComponent(date)}';
  }

  if (host == 'home' || path == 'home') {
    return AppRoutes.home;
  }

  if (host == 'fees' || path == 'fees') {
    if (clubId.isEmpty) return AppRoutes.home;
    return AppRoutes.clubMyFeePath(clubId);
  }

  return null;
}

/// Applique le clubId de la query au session provider si présent.
void applyDeepLinkClubSession({
  required WidgetRef ref,
  required Uri uri,
}) {
  final clubId = uri.queryParameters['clubId']?.trim();
  if (clubId == null || clubId.isEmpty) return;
  final current = ref.read(sessionProvider).activeClubId;
  if (current == clubId) return;
  ref.read(sessionProvider.notifier).setActiveClub(clubId);
}

/// Écoute les deep links et redirige vers la route correspondante.
void bindAppDeepLinks({
  required WidgetRef ref,
  required GoRouter router,
}) {
  final appLinks = AppLinks();

  Future<void> handleUri(Uri? uri) async {
    if (uri == null) return;
    applyDeepLinkClubSession(ref: ref, uri: uri);
    final route = deepLinkRouteFromUri(uri);
    if (route == null) return;
    router.go(route);
  }

  appLinks.getInitialLink().then(handleUri);
  appLinks.uriLinkStream.listen(handleUri);
}
