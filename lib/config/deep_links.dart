import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/models/viro_user.dart';
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

  if (host == 'chat' || path == 'chat') {
    // Messagerie cachée en release : un lien chat n’ouvre rien.
    if (!FeatureFlags.chatMessagingLive) return null;
    final conversationId =
        uri.queryParameters['conversationId']?.trim() ?? '';
    if (clubId.isEmpty) return AppRoutes.conversations;
    if (conversationId.isEmpty) return AppRoutes.conversations;
    return AppRoutes.conversationPath(clubId, conversationId);
  }

  return null;
}

/// `clubId` d’un deep link, `null` si absent ou vide.
String? deepLinkClubId(Uri uri) {
  final clubId = uri.queryParameters['clubId']?.trim();
  if (clubId == null || clubId.isEmpty) return null;
  return clubId;
}

/// Destination différée : lien ou tap push reçu avant que la session soit
/// prête (app tuée, profil pas encore chargé). Consommée par le routeur au
/// moment où il quitte `/loading`, à la place de `/home`.
class PendingDeepLink {
  const PendingDeepLink({required this.route, this.clubId});

  final String route;

  /// Club à activer avant d’ouvrir la route (si l’utilisateur y a accès).
  final String? clubId;
}

class PendingDeepLinkNotifier extends Notifier<PendingDeepLink?> {
  @override
  PendingDeepLink? build() => null;

  void set(PendingDeepLink link) => state = link;

  void clear() => state = null;

  /// Renvoie la destination en attente et l’efface.
  PendingDeepLink? consume() {
    final link = state;
    state = null;
    return link;
  }
}

final pendingDeepLinkProvider =
    NotifierProvider<PendingDeepLinkNotifier, PendingDeepLink?>(
  PendingDeepLinkNotifier.new,
);

/// `true` si l’utilisateur a accès à ce club : fiche membre **ou** lien
/// parent actif. Un lien vers un club inconnu ne doit pas changer la session.
bool userCanOpenClub(ViroUser user, String clubId) =>
    user.isLicensedInClub(clubId) ||
    user.activeParentLinksInClub(clubId).isNotEmpty;

/// Active le club du lien si l’utilisateur y a accès. Renvoie `false` sinon
/// (session inchangée).
bool applyDeepLinkClubSession({
  required WidgetRef ref,
  required ViroUser user,
  required String clubId,
}) {
  if (!userCanOpenClub(user, clubId)) return false;
  final current = ref.read(sessionProvider).activeClubId;
  if (current != clubId) {
    ref.read(sessionProvider.notifier).setActiveClub(
          clubId,
          role: user.membershipInClub(clubId)?.role,
        );
  }
  return true;
}

/// Prépare la session club d’une destination en attente dès que le profil est
/// chargé : le routeur consommera ensuite la route. Un club inaccessible
/// annule la destination (le routeur ira sur `/home`).
void prepareSessionForPendingDeepLink({
  required WidgetRef ref,
  required ViroUser user,
}) {
  final pending = ref.read(pendingDeepLinkProvider);
  final clubId = pending?.clubId;
  if (pending == null || clubId == null) return;
  final applied = applyDeepLinkClubSession(
    ref: ref,
    user: user,
    clubId: clubId,
  );
  if (!applied) {
    ref.read(pendingDeepLinkProvider.notifier).clear();
  }
}

/// Ouvre un deep link (lien universel ou tap push) selon l’état de session.
///
/// - Profil chargé : session club (si accès) puis navigation immédiate.
/// - Lien `join` : route publique, navigation immédiate (session ou pas).
/// - Sinon (app à froid, session en cours de résolution, déconnecté) : mise
///   en attente, le routeur y va dès que la session est prête.
void handleDeepLinkUri({
  required WidgetRef ref,
  required GoRouter router,
  required Uri uri,
}) {
  final route = deepLinkRouteFromUri(uri);
  if (route == null) return;
  final clubId = deepLinkClubId(uri);

  if (route.startsWith(AppRoutes.join)) {
    router.go(route);
    return;
  }

  final user = ref.read(viroUserProvider).value;
  if (user == null) {
    ref
        .read(pendingDeepLinkProvider.notifier)
        .set(PendingDeepLink(route: route, clubId: clubId));
    return;
  }

  if (clubId != null) {
    final applied = applyDeepLinkClubSession(
      ref: ref,
      user: user,
      clubId: clubId,
    );
    if (!applied) {
      // Club inconnu pour cet utilisateur : on reste sur l’accueil.
      router.go(AppRoutes.home);
      return;
    }
  }
  router.go(route);
}

/// Écoute les deep links et redirige vers la route correspondante.
void bindAppDeepLinks({
  required WidgetRef ref,
  required GoRouter router,
}) {
  final appLinks = AppLinks();

  Future<void> handleUri(Uri? uri) async {
    if (uri == null) return;
    handleDeepLinkUri(ref: ref, router: router, uri: uri);
  }

  appLinks.getInitialLink().then(handleUri);
  appLinks.uriLinkStream.listen(handleUri);
}
