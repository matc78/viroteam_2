import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import 'package:viro_team_v2/config/deep_links.dart';
import 'package:viro_team_v2/config/router_refresh.dart';
import 'package:viro_team_v2/config/startup_session_gate.dart';

import 'package:viro_team_v2/config/feature_flags.dart';

import 'package:viro_team_v2/features/app_update/providers/app_update_providers.dart';

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
import 'package:viro_team_v2/features/club/screens/club_role_requests_screen.dart';
import 'package:viro_team_v2/features/club/screens/club_settings_screen.dart';
import 'package:viro_team_v2/features/equipment/screens/club_equipment_screen.dart';
import 'package:viro_team_v2/features/club/screens/club_detail_screen.dart';
import 'package:viro_team_v2/features/fees/screens/admin_fees_screen.dart';
import 'package:viro_team_v2/features/fees/screens/my_fee_screen.dart';
import 'package:viro_team_v2/features/planning/screens/add_event_screen.dart';
import 'package:viro_team_v2/features/planning/screens/club_planning_screen.dart';
import 'package:viro_team_v2/features/planning/screens/member_planning_screen.dart';
import 'package:viro_team_v2/features/members/screens/club_members_screen.dart';
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

import 'package:viro_team_v2/features/join/screens/request_role_screen.dart';

import 'package:viro_team_v2/features/settings/screens/account_settings_screen.dart';
import 'package:viro_team_v2/features/settings/screens/appearance_settings_screen.dart';
import 'package:viro_team_v2/features/settings/screens/delete_account_screen.dart';
import 'package:viro_team_v2/features/settings/screens/notification_settings_screen.dart';
import 'package:viro_team_v2/features/settings/screens/privacy_settings_screen.dart';
import 'package:viro_team_v2/features/settings/screens/user_settings_screen.dart';

import 'package:viro_team_v2/providers/session_provider.dart';

import 'package:viro_team_v2/screens/dev/design_system_preview_screen.dart';



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

  static const joinRequestRole = '/join/request-role';

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

  static const clubPlanning = '/club/:clubId/planning';

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

  static const clubRoleRequests = '/club/:clubId/role-requests';

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

  static String clubRoleRequestsPath(String clubId) =>

      '/club/$clubId/role-requests';

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



      if (!isAuth) {

        if (path == AppRoutes.joinPreview && pending.hasInvitation) {

          return null;

        }

        if (path == AppRoutes.loading) {

          return AppRoutes.entry;

        }

        if (!isPublic &&

            path != AppRoutes.joinPreview &&

            path != AppRoutes.joinRequestRole) {

          return AppRoutes.entry;

        }

        return null;

      }



      if (user == null) {
        const allowedWithoutProfile = {
          AppRoutes.entry,
          AppRoutes.join,
          AppRoutes.joinPreview,
          AppRoutes.joinRequestRole,
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

      if (needsNameConfirmation) {
        final completingProfile = path == AppRoutes.signup &&
            state.uri.queryParameters['complete'] == '1';
        if (!completingProfile) {
          final intentParam =
              ref.read(signUpIntentProvider) == SignUpIntent.join
                  ? 'join'
                  : 'founder';
          return '${AppRoutes.signup}?complete=1&intent=$intentParam';
        }
      } else {
        final needsClubSetup = !user.hasClubs &&
            !user.profileCompleted &&
            ref.read(signUpIntentProvider) == SignUpIntent.founder;

        if (needsClubSetup && !inSetup) {
          return AppRoutes.clubSetup;
        }
      }



      if (path == AppRoutes.entry ||

          path == AppRoutes.login ||

          path == AppRoutes.signup ||

          path == AppRoutes.loading) {

        if (user.hasClubs) {
          // Push / lien reçu avant que la session soit prête : on y va
          // directement au lieu de l’accueil.
          final pendingLink =
              ref.read(pendingDeepLinkProvider.notifier).consume();
          final target = pendingDeepLinkTarget(pendingLink, user);
          final linkClubId = pendingLink?.clubId;
          if (target != AppRoutes.home && linkClubId != null) {
            // Pas de mutation de provider pendant la résolution de route.
            Future.microtask(() {
              if (ref.read(sessionProvider).activeClubId != linkClubId) {
                ref.read(sessionProvider.notifier).setActiveClub(
                      linkClubId,
                      role: user.membershipInClub(linkClubId)?.role,
                    );
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

        // Noms à confirmer : rester sur signup?complete=1.
        if (path == AppRoutes.signup &&
            state.uri.queryParameters['complete'] == '1' &&
            needsNameConfirmation) {
          return null;
        }

        if (pending.hasInvitation) {

          return AppRoutes.joinPreview;

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

        path: AppRoutes.joinRequestRole,

        builder: (context, state) => const RequestRoleScreen(),

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
            FeatureFlags.chatMessagingLive ? null : AppRoutes.home,
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
            FeatureFlags.chatMessagingLive ? null : AppRoutes.home,
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

          return ClubMembersScreen(clubId: clubId);

        },

      ),

      GoRoute(

        path: AppRoutes.clubAnnouncements,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubAnnouncementsScreen(clubId: clubId);

        },

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

          return AddEventScreen(

            clubId: clubId,

            initialDate: initialDate,

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

          return AdminFeesScreen(clubId: clubId);

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

          return ClubAppearanceScreen(clubId: clubId);

        },

      ),

      GoRoute(

        path: AppRoutes.clubEquipment,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubEquipmentScreen(clubId: clubId);

        },

      ),

      GoRoute(

        path: AppRoutes.clubActivity,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubActivityScreen(clubId: clubId);

        },

      ),

      GoRoute(

        path: AppRoutes.clubSettings,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubSettingsScreen(clubId: clubId);

        },

      ),

      GoRoute(

        path: AppRoutes.clubRoleRequests,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubRoleRequestsScreen(clubId: clubId);

        },

      ),

      GoRoute(

        path: AppRoutes.clubLocations,

        builder: (_, state) {

          final clubId = state.pathParameters['clubId']!;

          return ClubLocationsScreen(clubId: clubId);

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

