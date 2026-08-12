import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';

/// Parse un deep link `viroteam://join?code=…` en route GoRouter.
String? deepLinkRouteFromUri(Uri uri) {
  final isJoinHost = uri.host == 'join';
  final isJoinPath = uri.path == '/join' || uri.path == 'join';
  if (!isJoinHost && !isJoinPath) return null;

  final code = uri.queryParameters['code']?.trim();
  if (code == null || code.isEmpty) return AppRoutes.join;
  return '${AppRoutes.join}?code=${Uri.encodeQueryComponent(code)}';
}

/// Écoute les deep links et redirige vers la route join correspondante.
void bindAppDeepLinks({
  required WidgetRef ref,
  required GoRouter router,
}) {
  final appLinks = AppLinks();

  Future<void> handleUri(Uri? uri) async {
    if (uri == null) return;
    final route = deepLinkRouteFromUri(uri);
    if (route == null) return;
    router.go(route);
  }

  appLinks.getInitialLink().then(handleUri);
  appLinks.uriLinkStream.listen(handleUri);
}
