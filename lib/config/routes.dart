import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import 'package:viro_team_v2/config/deep_links.dart';
import 'package:viro_team_v2/config/router_refresh.dart';
import 'package:viro_team_v2/config/startup_session_gate.dart';

import 'package:viro_team_v2/features/app_update/providers/app_update_providers.dart';
import 'package:viro_team_v2/features/chat/providers/chat_messaging_live_provider.dart';

import 'package:viro_team_v2/features/app_update/screens/app_update_required_screen.dart';

import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';

import 'package:viro_team_v2/features/auth/screens/auth_loading_screen.dart';
import 'package:viro_team_v2/features/auth/screens/startup_blocked_screen.dart';

import 'package:viro_team_v2/features/auth/screens/login_screen.dart';

import 'package:viro_team_v2/features/auth/screens/onboarding_entry_screen.dart';

import 'package:viro_team_v2/features/auth/screens/sign_up_screen.dart';

import 'package:viro_team_v2/features/announcements/screens/club_announcements_screen.dart';
import 'package:viro_team_v2/features/calendar/screens/calendar_sync_screen.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/screens/club_appearance_screen.dart';
import 'package:viro_team_v2/features/club/screens/club_activity_screen.dart';
import 'package:viro_team_v2/features/club/screens/club_locations_screen.dart';
import 'package:viro_team_v2/features/club/screens/club_settings_screen.dart';
import 'package:viro_team_v2/features/equipment/screens/club_equipment_screen.dart';
import 'package:viro_team_v2/features/club/screens/club_detail_screen.dart';
import 'package:viro_team_v2/features/fees/screens/admin_fees_screen.dart';
import 'package:viro_team_v2/features/fees/screens/my_fee_screen.dart';
import 'package:viro_team_v2/features/planning/screens/add_event_screen.dart';
import 'package:viro_team_v2/features/planning/screens/club_planning_screen.dart';
import 'package:viro_team_v2/features/planning/screens/member_planning_screen.dart';
import 'package:viro_team_v2/features/members/screens/club_members_screen.dart';
import 'package:viro_team_v2/features/standings/screens/pool_team_season_screen.dart';
import 'package:viro_team_v2/features/standings/screens/team_standings_screen.dart';
import 'package:viro_team_v2/features/training/screens/training_board_screen.dart';
import 'package:viro_team_v2/features/training/screens/training_drill_editor_screen.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/features/training/screens/training_feedback_hub_screen.dart';
import 'package:viro_team_v2/features/training/screens/training_feedback_list_screen.dart';
import 'package:viro_team_v2/features/training/screens/training_feedback_received_screen.dart';
import 'package:viro_team_v2/features/training/screens/training_feedback_review_screen.dart';
import 'package:viro_team_v2/features/training/screens/training_feedback_screen.dart';
import 'package:viro_team_v2/features/training/screens/training_prep_screen.dart';
import 'package:viro_team_v2/features/teams/screens/teams_hub_screen.dart';

import 'package:viro_team_v2/features/club_setup/screens/club_setup_wizard_screen.dart';

import 'package:viro_team_v2/features/clubs/screens/club_selector_screen.dart';

import 'package:viro_team_v2/features/home/screens/home_member_screen.dart';
import 'package:viro_team_v2/features/chat/screens/conversations_screen.dart';
import 'package:viro_team_v2/features/chat/screens/chat_thread_screen.dart';
import 'package:viro_team_v2/features/chat/chat_thread_open_seed.dart';
import 'package:viro_team_v2/widgets/common/viro_bubble_expand_page.dart';
import 'package:viro_team_v2/widgets/common/viro_slide_page.dart';

import 'package:viro_team_v2/features/join/providers/pending_invitation_provider.dart';

import 'package:viro_team_v2/features/join/screens/invitation_preview_screen.dart';

import 'package:viro_team_v2/features/join/screens/join_code_screen.dart';

import 'package:viro_team_v2/features/settings/screens/account_settings_screen.dart';
import 'package:viro_team_v2/features/settings/screens/appearance_settings_screen.dart';
import 'package:viro_team_v2/features/settings/screens/delete_account_screen.dart';
import 'package:viro_team_v2/features/settings/screens/notification_settings_screen.dart';
import 'package:viro_team_v2/features/settings/screens/privacy_settings_screen.dart';
import 'package:viro_team_v2/features/settings/screens/user_settings_screen.dart';

import 'package:viro_team_v2/providers/session_provider.dart';

import 'package:viro_team_v2/screens/dev/design_system_preview_screen.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/widgets/common/club_access_guard.dart';



abstract final class AppRoutes {

  static const entry = '/';

  static const loading = '/loading';

  /// Session Auth ouverte, Firestore ou App Check a refusé le démarrage.
  static const startupBlocked = '/startup-blocked';

  static const updateRequired = '/update-required';

  static const login = '/login';

  static const signup = '/signup';

  static const join = '/join';

  static const joinPreview = '/join/preview';

  static const clubSetup = '/club-setup';

  static const home = '/home';

  static const memberPlanning = '/planning';

  static const profile = '/profile';

  static const userSettings = '/settings';

  static const settingsAccount = '/settings/account';

  static const settingsDeleteAccount = '/settings/account/delete';

  static const settingsNotifications = '/settings/notifications';

  static const settingsAppearance = '/settings/appearance';

  static const settingsPrivacy = '/settings/privacy';

  static const clubs = '/clubs';

  static const clubDetail = '/club/:clubId';

  static const clubMembers = '/club/:clubId/members';

  static const clubMyTeams = '/club/:clubId/teams';

  static const clubManageTeams = '/club/:clubId/teams/manage';

  /// Classement de la poule fédérale d'une équipe (joueurs, coachs, parents).
  static const clubTeamStandings = '/club/:clubId/teams/:teamId/standings';

  /// Saison d'une équipe de la poule (parcours, stats, salles).
  static const clubTeamStandingsSeason =
      '/club/:clubId/teams/:teamId/standings/:poolTeamKey';

  static const clubPlanning = '/club/:clubId/planning';

  /// Page Feedback, tous clubs : « Gestion » et « Pour moi » ;
  /// `?tab=manage|mine` choisit la partie ouverte.
  static const trainingFeedbackHub = '/feedback';

  /// Page Feedback ouverte sur [tab] (partie par défaut si `null`).
  static String trainingFeedbackHubPath({TrainingFeedbackHubTab? tab}) => Uri(
    path: trainingFeedbackHub,
    queryParameters: tab == null ? null : {'tab': tab.name},
  ).toString();

  /// Feedback entraînement : entraînements passés de mes équipes.
  static const clubTrainingFeedbackList = '/club/:clubId/training/feedback';

  /// Retour de séance d'un coach (saisie).
  static const clubTrainingFeedback = '/club/:clubId/events/:eventId/feedback';

  /// Retours envoyés sur une séance (lecture seule, coachs et admin) ;
  /// `?coach=` limite à un coach.
  static const clubTrainingFeedbackReview =
      '/club/:clubId/events/:eventId/feedback/review';

  /// Retour du coach reçu par un joueur (ou son parent) ; `?member=` : fiche
  /// destinataire (soi ou enfant).
  static const clubTrainingFeedbackReceived =
      '/club/:clubId/events/:eventId/feedback/received';

  /// Préparation d'un entraînement (une partie par coach).
  static const clubTrainingPrep = '/club/:clubId/events/:eventId/prep';

  /// Exercice de la préparation d'un coach.
  static const clubTrainingDrill =
      '/club/:clubId/events/:eventId/prep/:coachUid/drill/:drillId';

  /// Tableau blanc d'un exercice (index dans `boards`).
  static const clubTrainingBoard =
      '/club/:clubId/events/:eventId/prep/:coachUid/drill/:drillId/board/:boardIndex';

  static const clubAddEvent = '/club/:clubId/planning/add';

  static const clubAnnouncements = '/club/:clubId/announcements';

  static const clubFees = '/club/:clubId/fees';

  static const clubMyFee = '/club/:clubId/fees/mine';

  static const clubFeePay = '/club/:clubId/fees/pay';

  static const clubCalendarSync = '/club/:clubId/calendar-sync';

  static const clubAppearance = '/club/:clubId/appearance';

  static const clubEquipment = '/club/:clubId/equipment';

  static const clubActivity = '/club/:clubId/activity';

  static const clubSettings = '/club/:clubId/settings';

  static const clubLocations = '/club/:clubId/locations';

  static const conversations = '/conversations';

  static const conversation = '/conversations/:clubId/:conversationId';

  static const designPreview = '/dev/design';



  static String clubDetailPath(String clubId) => '/club/$clubId';

  static String clubMembersPath(String clubId) => '/club/$clubId/members';

  static String clubMyTeamsPath(String clubId, {String? tab}) {
    final base = '/club/$clubId/teams';
    if (tab == null || tab.isEmpty) return base;
    return '$base?tab=$tab';
  }

  static String clubManageTeamsPath(String clubId) =>
      clubMyTeamsPath(clubId, tab: 'manage');

  static String clubTeamStandingsPath(String clubId, String teamId) =>
      '/club/$clubId/teams/$teamId/standings';

  static String clubTeamStandingsSeasonPath(
    String clubId,
    String teamId,
    String poolTeamKey,
  ) => '/club/$clubId/teams/$teamId/standings/${Uri.encodeComponent(poolTeamKey)}';


  /// Planning du club, ouvert sur [date] (`YYYY-MM-DD`) avec l’event
  /// [eventId] mis en avant (deep link de notif).
  static String clubPlanningPath(
    String clubId, {
    String? date,
    String? eventId,
  }) {
    final base = '/club/$clubId/planning';
    final query = <String, String>{
      if (date != null && date.isNotEmpty) 'date': date,
      if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
    };
    if (query.isEmpty) return base;
    return Uri(path: base, queryParameters: query).toString();
  }

  static String clubTrainingFeedbackListPath(String clubId) =>
      '/club/$clubId/training/feedback';

  static String clubTrainingFeedbackPath(String clubId, String eventId) =>
      '/club/$clubId/events/$eventId/feedback';

  static String clubTrainingFeedbackReviewPath(
    String clubId,
    String eventId, {
    String? coachUid,
  }) => Uri(
    path: '/club/$clubId/events/$eventId/feedback/review',
    queryParameters: coachUid == null ? null : {'coach': coachUid},
  ).toString();

  static String clubTrainingFeedbackReceivedPath(
    String clubId,
    String eventId, {
    required String memberId,
  }) => Uri(
    path: '/club/$clubId/events/$eventId/feedback/received',
    queryParameters: {'member': memberId},
  ).toString();

  static String clubTrainingPrepPath(String clubId, String eventId) =>
      '/club/$clubId/events/$eventId/prep';

  static String clubTrainingDrillPath(
    String clubId,
    String eventId,
    String coachUid,
    String drillId,
  ) => '/club/$clubId/events/$eventId/prep/$coachUid/drill/$drillId';

  static String clubTrainingBoardPath(
    String clubId,
    String eventId,
    String coachUid,
    String drillId,
    int boardIndex,
  ) =>
      '/club/$clubId/events/$eventId/prep/$coachUid/drill/$drillId/board/$boardIndex';

  static String clubAnnouncementsPath(String clubId) =>
      '/club/$clubId/announcements';

  static String clubFeesPath(String clubId) => '/club/$clubId/fees';

  static String clubMyFeePath(String clubId) => '/club/$clubId/fees/mine';

  static String clubCalendarSyncPath(String clubId, {String? eventId}) {
    final base = '/club/$clubId/calendar-sync';
    if (eventId == null || eventId.isEmpty) return base;
    return '$base?eventId=$eventId';
  }

  static String clubAddEventPath(String clubId, {String? date}) {
    final base = '/club/$clubId/planning/add';
    if (date == null || date.isEmpty) return base;
    return '$base?date=$date';
  }

  static String clubAppearancePath(String clubId) => '/club/$clubId/appearance';

  static String clubEquipmentPath(String clubId) => '/club/$clubId/equipment';

  static String clubActivityPath(String clubId) => '/club/$clubId/activity';

  static String clubSettingsPath(String clubId) => '/club/$clubId/settings';

  static String clubLocationsPath(String clubId) => '/club/$clubId/locations';

  static String conversationPath(String clubId, String conversationId) =>
      '/conversations/$clubId/$conversationId';

  /// Écran de mise à jour obligatoire, en mémorisant la route demandée
  /// [from] (`?from=`) pour y revenir si l'exigence est levée.
  static String updateRequiredPath({required Uri from}) {
    if (from.path == loading) return updateRequired;
    return Uri(
      path: updateRequired,
      queryParameters: {'from': from.toString()},
    ).toString();
  }

  /// Destination une fois l'exigence levée : la route mémorisée par
  /// [updateRequiredPath] si elle est interne, sinon le chargement.
  static String afterUpdateRequired(Uri location) {
    final from = location.queryParameters['from'];
    final isInternal =
        from != null && from.startsWith('/') && !from.startsWith('//');
    return isInternal ? from : loading;
  }

}

/// `true` si le routeur doit envoyer [user] sur la création de club : pas de
/// club, profil non finalisé, intention « fondateur », et pas de parcours
/// d’invitation en cours ([inInvitationFlow] : écran `/join*` ou invitation
/// en attente). Un invité n’est ainsi jamais bloqué dans `/club-setup`.
bool needsClubSetupRedirect({
  required ViroUser user,
  required SignUpIntent intent,
  required bool inInvitationFlow,
}) {
  if (inInvitationFlow) return false;
  return !user.hasClubs &&
      !user.profileCompleted &&
      intent == SignUpIntent.founder;
}

/// Location `signup?complete=1` pour confirmer prénom / nom : intention
/// « rejoindre » si [intent] l’est ou si un parcours d’invitation est en
/// cours ([inInvitationFlow]), en conservant le [code] d’invitation saisi.
String completeNamesLocation({
  required SignUpIntent intent,
  required bool inInvitationFlow,
  String? code,
}) {
  final isJoin = inInvitationFlow || intent == SignUpIntent.join;
  final trimmedCode = code?.trim();
  return Uri(
    path: AppRoutes.signup,
    queryParameters: {
      'complete': '1',
      'intent': isJoin ? 'join' : 'founder',
      if (trimmedCode != null && trimmedCode.isNotEmpty) 'code': trimmedCode,
    },
  ).toString();
}

/// Extra go_router : messagerie ouverte après swipe interactif home.
///
/// La révélation est déjà terminée → transition push à durée zéro.
class ConversationsSwipeCommit {
  const ConversationsSwipeCommit();
}



final routerRefreshProvider = Provider<RouterRefreshNotifier>((ref) {

  final notifier = RouterRefreshNotifier();

  ref.listen(authStateProvider, (previous, next) => notifier.notify());

  ref.listen(firestoreAuthReadyProvider, (previous, next) => notifier.notify());

  ref.listen(viroUserProvider, (previous, next) => notifier.notify());

  ref.listen(sessionProvider, (previous, next) => notifier.notify());

  ref.listen(pendingInvitationProvider, (previous, next) => notifier.notify());

  ref.listen(signUpIntentProvider, (previous, next) => notifier.notify());

  ref.listen(appUpdateRequiredProvider, (previous, next) => notifier.notify());

  ref.onDispose(notifier.dispose);

  return notifier;

});



final goRouterProvider = Provider<GoRouter>((ref) {

  final refresh = ref.watch(routerRefreshProvider);



  return GoRouter(

    initialLocation: AppRoutes.loading,

    refreshListenable: refresh,

    observers: [
      // Écrans PostHog : nom = motif de route (`/club/:clubId`), sans id.
      PosthogObserver(),
    ],

    redirect: (context, state) {

      final auth = ref.read(authStateProvider);

      final firestoreAuth = ref.read(firestoreAuthReadyProvider);

      final profile = ref.read(viroUserProvider);

      final pending = ref.read(pendingInvitationProvider);



      final path = state.matchedLocation;

      // Mise à jour obligatoire : prioritaire sur tout le reste (auth comprise).
      final updateCheck = ref.read(appUpdateRequiredProvider);

      if (updateCheck.value ?? false) {
        return path == AppRoutes.updateRequired
            ? null
            : AppRoutes.updateRequiredPath(from: state.uri);
      }

      if (path == AppRoutes.updateRequired) {
        return AppRoutes.afterUpdateRequired(state.uri);
      }

      final isAuth = auth.maybeWhen(data: (u) => u != null, orElse: () => false);

      final user = profile.maybeWhen(data: (u) => u, orElse: () => null);

      // Refus Firestore / App Check : écran stable, pas le chargement en
      // boucle et pas Bienvenue (ça ressemblerait à une déconnexion).
      final startupFailure = StartupSessionGate.blockFailure(
        firestoreAuth: firestoreAuth,
        profile: profile,
      );
      final startupBlocked = isAuth && startupFailure != null;
      if (startupBlocked) {
        return path == AppRoutes.startupBlocked
            ? null
            : AppRoutes.startupBlocked;
      }
      if (path == AppRoutes.startupBlocked) {
        return AppRoutes.loading;
      }

      // Tant que la version minimale n'est pas connue (au plus
      // `appUpdateCheckTimeout`), on reste sur le chargement : un utilisateur
      // à bloquer ne doit pas entrevoir l'accueil.
      final sessionResolving = StartupSessionGate.stillResolving(
        updateKnown: updateCheck.hasValue,
        authLoading: auth.isLoading,
        signedIn: isAuth,
        firestoreAuthLoading: firestoreAuth.isLoading,
        profileLoading: profile.isLoading,
        blocked: startupBlocked,
      );



      final isPublic = path == AppRoutes.entry ||

          path == AppRoutes.login ||

          path == AppRoutes.signup ||

          path == AppRoutes.join ||

          (kDebugMode && path == AppRoutes.designPreview);



      if (sessionResolving) {

        return path == AppRoutes.loading ? null : AppRoutes.loading;

      }

      // Lien d’invitation reçu pendant le chargement (app à froid) : on
      // l’ouvre dès que la session est connue, quel que soit l’état du
      // compte. Les règles ci-dessous laissent passer `/join`.
      if (path == AppRoutes.loading) {
        final joinLink =
            ref.read(pendingDeepLinkProvider.notifier).consumeJoin();
        if (joinLink != null) return joinLink.route;
      }



      if (!isAuth) {

        if (path == AppRoutes.joinPreview && pending.hasInvitation) {

          return null;

        }

        if (path == AppRoutes.loading) {

          return AppRoutes.entry;

        }

        if (!isPublic && path != AppRoutes.joinPreview) {

          return AppRoutes.entry;

        }

        return null;

      }



      if (user == null) {
        const allowedWithoutProfile = {
          AppRoutes.entry,
          AppRoutes.join,
          AppRoutes.joinPreview,
          AppRoutes.signup,
        };

        String completeProfileLocation() {
          final intentFromQuery = state.uri.queryParameters['intent'];
          final intentParam = intentFromQuery == 'join' || intentFromQuery == 'founder'
              ? intentFromQuery!
              : (ref.read(signUpIntentProvider) == SignUpIntent.join
                  ? 'join'
                  : 'founder');
          final params = <String, String>{
            'complete': '1',
            'intent': intentParam,
          };
          final code = state.uri.queryParameters['code'];
          if (code != null && code.isNotEmpty) params['code'] = code;
          return Uri(
            path: AppRoutes.signup,
            queryParameters: params,
          ).toString();
        }

        // Auth sans fiche : login / clubSetup → complete=1 (persistant).
        // Pas de redirect auto depuis /signup brut : ça casserait le submit
        // email (Auth créé avant la fiche Firestore).
        if (path == AppRoutes.login || path == AppRoutes.clubSetup) {
          return completeProfileLocation();
        }

        if (allowedWithoutProfile.contains(path)) {
          return null;
        }

        return AppRoutes.entry;
      }



      final inSetup = path == AppRoutes.clubSetup;

      final nameIncomplete = user.firstName.trim().isEmpty ||
          user.lastName.trim().isEmpty;

      final needsNameConfirmation = !user.hasClubs &&
          !user.profileCompleted &&
          nameIncomplete;

      // Parcours d’invitation en cours (écran `/join*` ou invitation en
      // attente) : jamais détourné vers la création de club.
      final inInvitationFlow = isInvitationPath(path) || pending.hasInvitation;

      if (needsNameConfirmation) {
        final completingProfile = path == AppRoutes.signup &&
            state.uri.queryParameters['complete'] == '1';
        if (!completingProfile) {
          return completeNamesLocation(
            intent: ref.read(signUpIntentProvider),
            inInvitationFlow: inInvitationFlow,
            code: path == AppRoutes.join
                ? state.uri.queryParameters['code']
                : null,
          );
        }
      } else if (!inSetup &&
          needsClubSetupRedirect(
            user: user,
            intent: ref.read(signUpIntentProvider),
            inInvitationFlow: inInvitationFlow,
          )) {
        return AppRoutes.clubSetup;
      }



      if (path == AppRoutes.entry ||

          path == AppRoutes.login ||

          path == AppRoutes.signup ||

          path == AppRoutes.loading) {

        // Noms à confirmer : rester sur signup?complete=1.
        if (path == AppRoutes.signup &&
            state.uri.queryParameters['complete'] == '1' &&
            needsNameConfirmation) {
          return null;
        }

        // Invitation en attente (ex. « utiliser un autre compte » puis
        // connexion) : prioritaire pour tous les comptes, avec ou sans club.
        if (pending.hasInvitation) {

          return AppRoutes.joinPreview;

        }

        if (user.hasClubs) {
          // Push / lien reçu avant que la session soit prête : on y va
          // directement au lieu de l’accueil.
          final pendingLink =
              ref.read(pendingDeepLinkProvider.notifier).consume();
          final target = pendingDeepLinkTarget(pendingLink, user);
          // Club + enfant du lien, y compris vers `/home` (push RSVP).
          final linkClubId = pendingDeepLinkClubToApply(pendingLink, user);
          if (linkClubId != null) {
            // Pas de mutation de provider pendant la résolution de route.
            Future.microtask(() {
              if (ref.read(sessionProvider).activeClubId != linkClubId) {
                ref.read(sessionProvider.notifier).setActiveClub(linkClubId);
              }
              selectDeepLinkChild(
                select: (clubId, memberId) => ref
                    .read(clubAudienceSelectionProvider.notifier)
                    .select(clubId: clubId, memberId: memberId),
                user: user,
                clubId: linkClubId,
                memberId: pendingLink?.memberId,
              );
            });
          }
          return target;

        }

        return AppRoutes.entry;

      }



      return null;

    },

    routes: [

      GoRoute(

        path: AppRoutes.loading,

        builder: (context, state) => const AuthLoadingScreen(),

      ),

      GoRoute(

        path: AppRoutes.startupBlocked,

        builder: (context, state) => const StartupBlockedScreen(),

      ),

      GoRoute(

        path: AppRoutes.updateRequired,

        builder: (context, state) => const AppUpdateRequiredScreen(),

      ),

      GoRoute(

        path: AppRoutes.entry,

        builder: (context, state) => const OnboardingEntryScreen(),

      ),

      GoRoute(

        path: AppRoutes.login,

        builder: (context, state) => const LoginScreen(),

      ),

      GoRoute(

        path: AppRoutes.signup,

        builder: (_, state) => SignUpScreen(

          intentParam: state.uri.queryParameters['intent'],

          codeParam: state.uri.queryParameters['code'],

          completeParam: state.uri.queryParameters['complete'],

        ),

      ),

      GoRoute(

        path: AppRoutes.join,

        builder: (_, state) => JoinCodeScreen(

          initialCode: state.uri.queryParameters['code'],

        ),

      ),

      GoRoute(

        path: AppRoutes.joinPreview,

        builder: (context, state) => const InvitationPreviewScreen(),

      ),

      GoRoute(

        path: AppRoutes.clubSetup,

        builder: (context, state) => const ClubSetupWizardScreen(),

      ),

      GoRoute(

        path: AppRoutes.home,

        builder: (context, state) => const HomeMemberScreen(),

      ),

      GoRoute(
        path: AppRoutes.conversations,
        redirect: (context, state) =>
            ref.read(chatMessagingLiveProvider) ? null : AppRoutes.home,
        pageBuilder: (context, state) {
          if (state.extra is ConversationsSwipeCommit) {
            return ViroSlidePage<void>(
              key: state.pageKey,
              name: state.path,
              transitionDuration: Duration.zero,
              child: const ConversationsScreen(),
            );
          }
          final origin = state.extra is Offset ? state.extra as Offset : null;
          return ViroBubbleExpandPage<void>(
            key: state.pageKey,
            name: state.path,
            origin: origin,
            child: const ConversationsScreen(),
          );
        },
      ),

      GoRoute(
        path: AppRoutes.conversation,
        redirect: (context, state) =>
            ref.read(chatMessagingLiveProvider) ? null : AppRoutes.home,
        pageBuilder: (context, state) {
          final clubId = state.pathParameters['clubId']!;
          final conversationId = state.pathParameters['conversationId']!;
          final openSeed = state.extra is ChatThreadOpenSeed
              ? state.extra as ChatThreadOpenSeed
              : null;
          return ViroSlidePage<void>(
            key: state.pageKey,
            name: state.path,
            child: ChatThreadScreen(
              clubId: clubId,
              conversationId: conversationId,
              openSeed: openSeed,
            ),
          );
        },
      ),

      GoRoute(

        path: AppRoutes.memberPlanning,

        builder: (context, state) => const MemberPlanningScreen(),

      ),

      GoRoute(

        path: AppRoutes.userSettings,

        builder: (context, state) => const UserSettingsScreen(),

      ),

      GoRoute(

        path: AppRoutes.settingsAccount,

        builder: (context, state) => const AccountSettingsScreen(),

      ),

      GoRoute(

        path: AppRoutes.settingsDeleteAccount,

        builder: (context, state) => const DeleteAccountScreen(),

      ),

      GoRoute(

        path: AppRoutes.settingsNotifications,

        builder: (context, state) => const NotificationSettingsScreen(),

      ),

      GoRoute(

        path: AppRoutes.settingsAppearance,

        builder: (context, state) => const AppearanceSettingsScreen(),

      ),

      GoRoute(

        path: AppRoutes.settingsPrivacy,

        builder: (context, state) => const PrivacySettingsScreen(),

      ),

      GoRoute(

        path: AppRoutes.profile,

        redirect: (context, state) => AppRoutes.userSettings,

      ),

      GoRoute(

        path: AppRoutes.clubs,

        builder: (context, state) => const ClubSelectorScreen(),

      ),

      GoRoute(

        path: AppRoutes.clubDetail,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubDetailScreen(clubId: clubId);

        },

      ),

      GoRoute(

        path: AppRoutes.clubMembers,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubAccessGuard(
            clubId: clubId,
            allow: (access) => access.canOpenMembers,
            child: ClubMembersScreen(clubId: clubId),
          );

        },

      ),

      GoRoute(

        path: AppRoutes.clubAnnouncements,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubAnnouncementsScreen(clubId: clubId);

        },

      ),

      // Lecture protégée par les règles (membres du club, parents de
      // l'équipe) : pas de garde de droits, un parent n'a pas de fiche.
      GoRoute(
        path: AppRoutes.clubTeamStandings,
        builder: (_, state) => TeamStandingsScreen(
          clubId: state.pathParameters['clubId']!,
          teamId: state.pathParameters['teamId']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.clubTeamStandingsSeason,
        builder: (_, state) => PoolTeamSeasonScreen(
          clubId: state.pathParameters['clubId']!,
          teamId: state.pathParameters['teamId']!,
          poolTeamKey: state.pathParameters['poolTeamKey']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.trainingFeedbackHub,
        builder: (_, state) => TrainingFeedbackHubScreen(
          initialTab: TrainingFeedbackHubTab.values
              .where((tab) => tab.name == state.uri.queryParameters['tab'])
              .firstOrNull,
        ),
      ),
      GoRoute(
        path: AppRoutes.clubTrainingFeedbackList,
        builder: (_, state) =>
            TrainingFeedbackListScreen(clubId: state.pathParameters['clubId']!),
      ),
      GoRoute(
        path: AppRoutes.clubTrainingFeedback,
        builder: (_, state) => TrainingFeedbackScreen(
          clubId: state.pathParameters['clubId']!,
          eventId: state.pathParameters['eventId']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.clubTrainingFeedbackReview,
        builder: (_, state) => TrainingFeedbackReviewScreen(
          clubId: state.pathParameters['clubId']!,
          eventId: state.pathParameters['eventId']!,
          coachUid: state.uri.queryParameters['coach'],
        ),
      ),
      GoRoute(
        path: AppRoutes.clubTrainingFeedbackReceived,
        // Lien sans fiche destinataire : la liste des retours reçus.
        redirect: (_, state) => state.uri.queryParameters['member'] == null
            ? AppRoutes.trainingFeedbackHubPath(
                tab: TrainingFeedbackHubTab.mine,
              )
            : null,
        builder: (_, state) => TrainingFeedbackReceivedScreen(
          clubId: state.pathParameters['clubId']!,
          eventId: state.pathParameters['eventId']!,
          memberId: state.uri.queryParameters['member']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.clubTrainingPrep,
        builder: (_, state) => TrainingPrepScreen(
          clubId: state.pathParameters['clubId']!,
          eventId: state.pathParameters['eventId']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.clubTrainingDrill,
        builder: (_, state) => TrainingDrillEditorScreen(
          clubId: state.pathParameters['clubId']!,
          eventId: state.pathParameters['eventId']!,
          coachUid: state.pathParameters['coachUid']!,
          drillId: state.pathParameters['drillId']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.clubTrainingBoard,
        builder: (_, state) => TrainingBoardScreen(
          clubId: state.pathParameters['clubId']!,
          eventId: state.pathParameters['eventId']!,
          coachUid: state.pathParameters['coachUid']!,
          drillId: state.pathParameters['drillId']!,
          boardIndex:
              int.tryParse(state.pathParameters['boardIndex'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: AppRoutes.clubManageTeams,
        redirect: (context, state) {
          final clubId = state.pathParameters['clubId']!;
          return AppRoutes.clubMyTeamsPath(clubId, tab: 'manage');
        },
      ),
      GoRoute(
        path: AppRoutes.clubMyTeams,
        builder: (_, state) {
          final clubId = state.pathParameters['clubId']!;
          final tab = state.uri.queryParameters['tab'];
          return TeamsHubScreen(
            clubId: clubId,
            initialTab: tab == 'manage'
                ? TeamsHubTab.manage
                : TeamsHubTab.mine,
          );
        },
      ),

      GoRoute(

        path: AppRoutes.clubAddEvent,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          final dateParam = state.uri.queryParameters['date'];

          DateTime? initialDate;

          if (dateParam != null && dateParam.isNotEmpty) {

            initialDate = DateTime.tryParse(dateParam);

          }

          return ClubAccessGuard(
            clubId: clubId,
            allow: (access) => access.canCreateEvents,
            child: AddEventScreen(clubId: clubId, initialDate: initialDate),
          );

        },

      ),

      GoRoute(

        path: AppRoutes.clubPlanning,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          final dateParam = state.uri.queryParameters['date'];

          DateTime? initialDate;

          if (dateParam != null && dateParam.isNotEmpty) {

            initialDate = DateTime.tryParse(dateParam);

          }

          final eventIdParam = state.uri.queryParameters['eventId'];

          return ClubPlanningScreen(

            clubId: clubId,

            initialDate: initialDate,

            focusEventId: eventIdParam != null && eventIdParam.isNotEmpty
                ? eventIdParam
                : null,

          );

        },

      ),

      GoRoute(

        path: AppRoutes.clubMyFee,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return MyFeeScreen(clubId: clubId);

        },

      ),

      GoRoute(

        path: AppRoutes.clubFeePay,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          // Deep link legacy `/fees/pay` → même écran que `/fees/mine`
          // (checkout via FeeCheckoutSheet sur MyFeeScreen).
          return MyFeeScreen(clubId: clubId);

        },

      ),

      GoRoute(

        path: AppRoutes.clubFees,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubAccessGuard(
            clubId: clubId,
            allow: (access) => access.can(ClubPermission.viewFees),
            deniedRedirect: AppRoutes.clubMyFeePath(clubId),
            child: AdminFeesScreen(clubId: clubId),
          );

        },

      ),

      GoRoute(

        path: AppRoutes.clubCalendarSync,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return CalendarSyncScreen(
            clubId: clubId,
            eventId: state.uri.queryParameters['eventId'],
          );

        },

      ),

      GoRoute(

        path: AppRoutes.clubAppearance,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubAccessGuard(
            clubId: clubId,
            allow: (access) => access.can(ClubPermission.manageClubSettings),
            child: ClubAppearanceScreen(clubId: clubId),
          );

        },

      ),

      GoRoute(

        path: AppRoutes.clubEquipment,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubAccessGuard(
            clubId: clubId,
            allow: (access) => access.can(ClubPermission.manageEquipment),
            child: ClubEquipmentScreen(clubId: clubId),
          );

        },

      ),

      GoRoute(

        path: AppRoutes.clubActivity,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubAccessGuard(
            clubId: clubId,
            allow: (access) => access.can(ClubPermission.viewActivity),
            child: ClubActivityScreen(clubId: clubId),
          );

        },

      ),

      GoRoute(

        path: AppRoutes.clubSettings,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubAccessGuard(
            clubId: clubId,
            allow: (access) => access.can(ClubPermission.manageClubSettings),
            child: ClubSettingsScreen(clubId: clubId),
          );

        },

      ),

      GoRoute(

        path: AppRoutes.clubLocations,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubAccessGuard(
            clubId: clubId,
            allow: (access) => access.can(ClubPermission.manageClubSettings),
            child: ClubLocationsScreen(clubId: clubId),
          );

        },

      ),

      if (kDebugMode)
        GoRoute(

          path: AppRoutes.designPreview,

          builder: (context, state) => const DesignSystemPreviewScreen(),

        ),

    ],

  );

});

