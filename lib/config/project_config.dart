import 'package:flutter/foundation.dart';

/// Configuration centrale du projet ViroTeam v2.
///
/// Référence humaine complète : [PROJECT_CONVENTIONS.md] à la racine du repo.
/// Thème détaillé : section « Thème & harmonisation visuelle » du même fichier.
/// Specs produit : `docs/specs/`.
abstract final class ProjectConfig {
  static const String appName = 'ViroTeam';

  // —— Version app (doit matcher `pubspec.yaml` et les tags `v*` / `release-v*`) ——
  /// Nom marketing (ex. `2.2.12`). Vérifié en CI contre le tag de release.
  static const String appVersionName = '2.3.0';

  /// Build number local (`+N` du pubspec). La CI release peut le surcharger.
  static const int appVersionCode = 21;

  // —— Firestore ——
  static const String firestoreDevDatabaseId = 'v2-dev';
  static const String firestoreProdDatabaseId = 'v2-prod';

  /// `--dart-define=FORCE_PROD_BACKEND=true` : force le backend de release
  /// (base `v2-prod`, callables sans suffixe Dev, portail prod) même en
  /// debug / profile. Usage : captures d'écran store sur simulateur.
  /// Sans le define, rien ne change (`false` par défaut).
  static const bool forceProdBackend =
      bool.fromEnvironment('FORCE_PROD_BACKEND');

  /// Backend de production actif (release, ou [forceProdBackend]).
  static bool get useProdBackend => kReleaseMode || forceProdBackend;

  static String get firestoreDatabaseId =>
      useProdBackend ? firestoreProdDatabaseId : firestoreDevDatabaseId;

  static const String firebaseProjectId = 'viroteam-75303';

  // —— Analytics produit (PostHog, hébergement UE) ——
  /// Clé publique du projet PostHog « ViroTeam prod » (release uniquement).
  static const String posthogProdApiKey =
      'phc_wMm5hy9zFdbcsgUXoibRunuxb2crXmL6iLnLSMLHBvBv';

  /// Clé publique du projet PostHog « ViroTeam dev » (debug / profile).
  static const String posthogDevApiKey =
      'phc_xwPxt9Kkn3qMDzf3utNvtpuPrrrfQ9Pe4KeY8ZenJ2ey';

  static const String posthogHost = 'https://eu.i.posthog.com';

  /// Clé PostHog active : prod en release seulement, pour que les sessions de
  /// test (y compris [forceProdBackend]) ne polluent pas les stats réelles.
  static String get posthogApiKey =>
      kReleaseMode ? posthogProdApiKey : posthogDevApiKey;

  // —— Portail web (bureau admin + espace famille parent) ——
  /// URL de base du portail.
  ///
  /// Bureau admin et, Phase 8, espace famille. Spec :
  /// [webPortalSpecDoc], [parentsSpecDoc].
  /// Release : `https://www.viroteam.com` — surcharge possible via
  /// `--dart-define=PORTAL_BASE_URL=...`
  static String get portalBaseUrl {
    const fromDefine = String.fromEnvironment('PORTAL_BASE_URL');
    if (fromDefine.isNotEmpty) return fromDefine;
    return useProdBackend
        ? 'https://www.viroteam.com'
        : 'http://localhost:3000';
  }

  /// URL Play Store (alignée portail `site.playStoreUrl`).
  static const String playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.viroteam.viro_team';

  /// URL App Store (alignée portail `site.appStoreUrl`).
  static const String appStoreUrl =
      'https://apps.apple.com/fr/app/viroteam/id6807822265';

  /// Jeton fournisseur App Store Connect (`pt`) des liens de campagne : sans
  /// lui, Apple ignore `ct`. Aligné portail `APP_STORE_PROVIDER_TOKEN`.
  static const String appStoreProviderToken = '';

  /// Site marketing / portail public (liens secondaires invitations).
  static const String siteUrl = 'https://www.viroteam.com';

  // —— Docs ——
  static const String roadmapDoc = 'docs/ROADMAP.md';

  // —— Specs (`docs/specs/`) ——
  static const String firestoreModelDoc =
      'docs/specs/viroteam_v2_firestore_model.md';
  static const String uxJourneyDoc =
      'docs/specs/viroteam_v2_ux_journey_detailed.md';
  static const String invitationModelDoc =
      'docs/specs/viroteam_v2_invitation_only_model.md';
  static const String webPortalSpecDoc =
      'docs/specs/viroteam_v2_web_portal_spec.md';
  static const String parentsSpecDoc =
      'docs/specs/viroteam_v2_parents_spec.md';
  static const String chatSpecDoc = 'docs/specs/viroteam_v2_chat_spec.md';

  // —— Collections Firestore (voir firestoreModelDoc) ——
  static const String usersCollection = 'users';
  static const String clubsCollection = 'clubs';
  static const String membersSubcollection = 'members';
  static const String guardiansSubcollection = 'guardians';
  static const String invitationsSubcollection = 'invitations';
  static const String retourUserCollection = 'retour_user';

  /// Config globale app, lisible sans être connecté (écriture console only).
  static const String appConfigCollection = 'app_config';

  /// Doc `app_config/mobile` : versions minimales Android / iOS.
  static const String mobileAppConfigDoc = 'mobile';

  /// Attente max de `app_config/mobile` au démarrage : au-delà, l'app
  /// démarre sans exigence de version (le blocage s'applique dès que
  /// Firestore répond).
  static const Duration appUpdateCheckTimeout = Duration(seconds: 3);

  static const String eventsSubcollection = 'events';
  static const String announcementsSubcollection = 'announcements';
  static const String teamsSubcollection = 'teams';
  static const String pendingMembersSubcollection = 'pending_members';
  static const String feeSeasonsSubcollection = 'fee_seasons';
  static const String memberFeesSubcollection = 'member_fees';
  static const String paymentEventsSubcollection = 'payment_events';
  static const String paymentSessionsSubcollection = 'payment_sessions';
  static const String activityEventsSubcollection = 'activity_events';
  static const String equipmentSubcollection = 'equipment';
  static const String conversationsSubcollection = 'conversations';
  static const String chatMessagesSubcollection = 'messages';
  static const String chatStateSubcollection = 'chatState';
  static const String paymentsHelloAssoSpecDoc =
      'docs/specs/viroteam_v2_payments_helloasso_spec.md';

  // —— Chemins code ——
  static const String configPath = 'lib/config';
  static const String widgetsPath = 'lib/widgets';
  static const String listTilesPath = 'lib/widgets/lists';

  // —— Thème (fichiers source de vérité) ——
  static const String themeEntry = 'lib/config/viro_theme.dart';
  static const String colorsEntry = 'lib/config/viro_colors.dart';
  static const String motionEntry = 'lib/config/viro_motion.dart';
  static const String iconsEntry = 'lib/config/viro_icons.dart';

  /// Shell obligatoire pour tout écran (fond dégradé + halos).
  static const String scaffoldWidget = 'lib/widgets/common/viro_scaffold.dart';

  /// En-tête claire — pas de AppBar bleue opaque.
  static const String appBarWidget = 'lib/widgets/common/viro_scaffold.dart';

  static const String cardWidget = 'lib/widgets/common/viro_card.dart';
  static const String roleBadgeWidget =
      'lib/widgets/common/viro_role_badge.dart';

  /// Règle : ne pas utiliser primary800+ comme fond plein écran / AppBar.
  static const bool forbidOpaquePrimaryAppBar = true;

  // —— Mise en page ——
  /// Largeur max du contenu centré (formulaires, cartes, grilles, états vides).
  static const double contentMaxWidth = 560;

  /// Contenu centré horizontalement sur grands écrans (tablette / web).
  /// Exceptions : listes longues scrollables (planning, membres, messages…)
  /// qui restent en pleine largeur avec padding [ViroSpacing.screenHorizontal].
  static const bool centerContentByDefault = true;

  // —— Feedback utilisateur ——
  /// Durée max des SnackBar (messages d'action, copie, erreurs légères).
  static const Duration snackBarDuration = Duration(milliseconds: 1500);

  /// Délai avant la pré-demande de permission notifs sur la home (laisse
  /// l'écran se poser avant d'ouvrir la sheet).
  static const Duration notificationSoftAskDelay = Duration(milliseconds: 1200);

  // —— Statut « vu » des convocations ——
  /// Temps d'affichage continu d'une carte avant de marquer l'event « vu ».
  static const Duration eventSeenDwell = Duration(seconds: 1);

  /// Part minimale de la carte visible à l'écran pour compter la vue.
  static const double eventSeenVisibleFraction = 0.5;

  // —— Droits & relations ——
  //
  // Droits purs : seule la liste `members/{uid}.permissions` fait foi
  // (catalogue : `shared/permissions_catalog.json`, [ClubPermission]).
  // Écrite par les Cloud Functions uniquement (`setMemberPermissions`).
  // Le droit `admin` implique tous les autres et permet seul d'en attribuer ;
  // le club garde toujours au moins un admin.
  //
  // Des fonctions prédéfinies (Responsable cotisations…) regroupent des
  // droits. Aucun rôle n'est stocké : les badges Admin / Entraîneur / Joueur /
  // Membre se dérivent de la fiche ([MemberBadge]).
  //
  // Index des clubs d'un compte : `users/{uid}.memberClubIds` (Functions).
  //
  // Deux relations, qui ne sont pas des droits :
  // - coach d'équipe : `teams.coachIds` (→ `members.coachTeamIds`), donne des
  //   capacités sur ses équipes, réglées par `clubs.coachPermissions` ;
  // - parent : `clubs/{clubId}/members/{memberId}/guardians/{parentUid}`
  //   + `users/{parentUid}.parentLinks[]` (identité du lien : parentUid,
  //   clubId, memberId).
  //
  // Point d'entrée unique côté app : [ClubAccess] / `clubAccessProvider`.
  // Voir [parentsSpecDoc], [FirestoreFields.parentLinks] et
  // [guardiansSubcollection].

  /// Champ utilisateur : index session parent → enfants (pas un droit).
  static const String parentLinksField = 'parentLinks';

  /// V1 : un seul guardian `active` ou `pending` par fiche enfant.
  static const int maxActiveGuardiansPerMember = 1;

  /// `invitations.type` pour un rattachement parent (pas `role: parent`).
  static const String invitationTypeMember = 'member';
  static const String invitationTypeGuardian = 'guardian';

  /// `guardians.relation` / `parentLinks.relation` — V1 uniquement `parent`.
  static const String guardianRelationParent = 'parent';
  static const String guardianRelationGrandparent = 'grandparent';
  static const String guardianRelationTutor = 'tutor';

  /// Statuts d’un lien guardian.
  static const String guardianStatusPending = 'pending';
  static const String guardianStatusActive = 'active';
  static const String guardianStatusRevoked = 'revoked';
}
