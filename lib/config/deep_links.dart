import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
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
    if (clubId.isEmpty) {
      return AppRoutes.memberPlanning;
    }
    return AppRoutes.clubPlanningPath(
      clubId,
      date: uri.queryParameters['date']?.trim(),
      eventId: uri.queryParameters['eventId']?.trim(),
    );
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

/// Enfant visé par un lien (push adressée à un parent), `null` si absent.
String? deepLinkMemberId(Uri uri) {
  final memberId = uri.queryParameters['memberId']?.trim();
  if (memberId == null || memberId.isEmpty) return null;
  return memberId;
}

/// Destination différée : lien ou tap push reçu avant que la session soit
/// prête (app tuée, profil pas encore chargé). Consommée par le routeur au
/// moment où il quitte `/loading`, à la place de `/home`.
class PendingDeepLink {
  const PendingDeepLink({required this.route, this.clubId, this.memberId});

  final String route;

  /// Club à activer avant d’ouvrir la route (si l’utilisateur y a accès).
  final String? clubId;

  /// Enfant à sélectionner (Moi | enfant) pour un parent.
  final String? memberId;
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

/// Enfant de [user] à sélectionner dans [clubId] pour un lien qui vise
/// [memberId] ; `null` si ce n’est pas un de ses enfants (lien périmé, autre
/// compte) : la sélection reste inchangée.
String? deepLinkChildToSelect(ViroUser user, String clubId, String? memberId) {
  if (memberId == null) return null;
  final isChild = user
      .activeParentLinksInClub(clubId)
      .any((link) => link.memberId == memberId);
  return isChild ? memberId : null;
}

/// Sélectionne l’enfant visé par le lien (planning, cotisation…) pour que
/// l’écran ouvert montre ses convocations et pas celles du parent.
void selectDeepLinkChild({
  required void Function(String clubId, String memberId) select,
  required ViroUser user,
  required String? clubId,
  required String? memberId,
}) {
  if (clubId == null) return;
  final child = deepLinkChildToSelect(user, clubId, memberId);
  if (child != null) select(clubId, child);
}

/// Route où le routeur envoie l’utilisateur en quittant `/loading` : la
/// destination en attente si elle existe et que son club est accessible,
/// sinon `/home`.
String pendingDeepLinkTarget(PendingDeepLink? link, ViroUser user) {
  if (link == null) return AppRoutes.home;
  final clubId = link.clubId;
  if (clubId != null && !userCanOpenClub(user, clubId)) return AppRoutes.home;
  return link.route;
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
  final memberId = deepLinkMemberId(uri);

  if (route.startsWith(AppRoutes.join)) {
    router.go(route);
    return;
  }

  final user = ref.read(viroUserProvider).value;
  if (user == null) {
    ref.read(pendingDeepLinkProvider.notifier).set(
          PendingDeepLink(route: route, clubId: clubId, memberId: memberId),
        );
    return;
  }

  selectDeepLinkChild(
    select: (clubId, memberId) => ref
        .read(clubAudienceSelectionProvider.notifier)
        .select(clubId: clubId, memberId: memberId),
    user: user,
    clubId: clubId,
    memberId: memberId,
  );

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
