import 'package:flutter/foundation.dart';

/// Configuration centrale du projet ViroTeam v2.
///
/// Référence humaine complète : [PROJECT_CONVENTIONS.md] à la racine du repo.
/// Thème détaillé : section « Thème & harmonisation visuelle » du même fichier.
/// Specs produit : `docs/specs/`.
abstract final class ProjectConfig {
  static const String appName = 'ViroTeam';

  // —— Firestore ——
  static const String firestoreDevDatabaseId = 'v2-dev';
  static const String firestoreProdDatabaseId = 'v2-prod';

  static String get firestoreDatabaseId =>
      kReleaseMode ? firestoreProdDatabaseId : firestoreDevDatabaseId;

  static const String firebaseProjectId = 'viroteam-75303';

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
    return kReleaseMode
        ? 'https://www.viroteam.com'
        : 'http://localhost:3000';
  }

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

  // —— Collections Firestore (voir firestoreModelDoc) ——
  static const String usersCollection = 'users';
  static const String clubsCollection = 'clubs';
  static const String membersSubcollection = 'members';
  static const String memberAccountsSubcollection = 'member_accounts';
  static const String guardiansSubcollection = 'guardians';
  static const String invitationsSubcollection = 'invitations';
  static const String joinRequestsCollection = 'join_requests';
  static const String retourUserCollection = 'retour_user';
  static const String eventsSubcollection = 'events';
  static const String announcementsSubcollection = 'announcements';
  static const String teamsSubcollection = 'teams';
  static const String pendingMembersSubcollection = 'pending_members';
  static const String feeSeasonsSubcollection = 'fee_seasons';
  static const String memberFeesSubcollection = 'member_fees';
  static const String paymentSessionsSubcollection = 'payment_sessions';
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

  // —— Rôles & permissions ——
  //
  // Hiérarchie club (héritage cumulatif) :
  //   Admin ⊃ Coach ⊃ Player
  // Un coach EST un joueur avec plus de droits.
  // Un admin EST un coach (donc aussi joueur) avec plus de droits.
  //
  // Parent ≠ rôle club. Relation adulte ↔ fiche joueur :
  //   clubs/{clubId}/members/{memberId}/guardians/{parentUid}
  //   users/{parentUid}.parentLinks[] : [{ clubId, memberId, relation, status }]
  // Identité du lien : (parentUid, clubId, memberId) — pas l’Auth uid enfant.
  //
  // AVANT (faux) : roles: ['player', 'coach', 'admin', 'parent']
  // APRÈS (bon)  : clubMemberships.role ∈ {player, coach, admin}
  //                + guardians / parentLinks pour le lien parent ↔ enfant
  //
  // Voir [parentsSpecDoc], [MemberRoles], [MemberRoleHierarchy],
  // [FirestoreFields.parentLinks] et [guardiansSubcollection].

  /// Rôles possibles dans `clubMemberships` / `members/{uid}.role`.
  static const List<String> clubMemberRoles = ['player', 'coach', 'admin'];

  /// Champ utilisateur : index session parent → enfants (pas un rôle).
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

  /// Résumé hiérarchie — Admin hérite de tout ce que Coach peut faire, etc.
  static const String roleInheritanceRule =
      'Admin hérite de Coach ; Coach hérite de Player.';

  // —— Player (base) ——
  static const String permPlayerPlanning = 'Voir son planning, RSVP';
  static const String permPlayerTeam = 'Voir son équipe';
  static const String permPlayerInviteParent =
      'Hors V1 : inviter un parent pour lui-même (V1 = admin uniquement)';
  static const String permPlayerRevokeParent =
      'Hors V1 : révoquer ses propres parents (V1 = admin)';

  // —— Coach (= Player +) ——
  static const String permCoachEvents = 'Créer événements, marquer présence';
  static const String permCoachTeam = 'Gérer sa propre équipe';
  static const String permCoachInvitePlayers =
      'Inviter des joueurs pour ses équipes';

  // —— Admin (= Coach +) ——
  static const String permAdminAll = 'Peut tout faire dans le club';
  static const String permAdminInvite =
      'Inviter joueurs, entraîneurs, admins';
  static const String permAdminInviteGuardian =
      'Inviter un parent sur une fiche joueur (V1, plafond 1)';
  static const String permAdminRevoke = 'Révoquer n\'importe qui';

  // —— Parent (relation, pas rôle club) — V1 : canView + canRsvp + canPay ——
  static const String permParentView =
      'Voir le planning et les annonces de l\'enfant';
  static const String permParentRsvp = 'RSVP pour l\'enfant';
  static const String permParentPay = 'Payer la cotisation de l\'enfant';
  static const String permParentCannot =
      'Ne peut pas créer d\'événements ni gérer l\'équipe';
  static const String permParentInvitedBy =
      'Invité par un admin du club (V1)';
  static const String permParentRevokedBy =
      'Révocable par un admin (V1) ; plus tard aussi par l\'enfant lié';
  static const String permParentAlsoMember =
      'Peut aussi être joueur / coach / admin dans le même club (segment Moi | enfant)';
}
