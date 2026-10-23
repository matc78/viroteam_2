import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/services/analytics_consent_service.dart';
import 'package:viro_team_v2/services/analytics_service.dart';
import 'package:viro_team_v2/services/account_service.dart';
import 'package:viro_team_v2/services/announcement_service.dart';
import 'package:viro_team_v2/services/app_update_service.dart';
import 'package:viro_team_v2/services/auth_service.dart';
import 'package:viro_team_v2/services/club_service.dart';
import 'package:viro_team_v2/services/club_activity_service.dart';
import 'package:viro_team_v2/services/equipment_service.dart';
import 'package:viro_team_v2/services/event_service.dart';
import 'package:viro_team_v2/services/fee_service.dart';
import 'package:viro_team_v2/services/guardian_service.dart';
import 'package:viro_team_v2/services/invitation_service.dart';
import 'package:viro_team_v2/services/join_request_service.dart';
import 'package:viro_team_v2/services/member_invite_service.dart';
import 'package:viro_team_v2/services/member_service.dart';
import 'package:viro_team_v2/services/portal_banner_prefs_service.dart';
import 'package:viro_team_v2/features/fees/services/fee_payment_analytics.dart';
import 'package:viro_team_v2/services/payment/payment_service.dart';
import 'package:viro_team_v2/services/notification_permission_service.dart';
import 'package:viro_team_v2/services/notification_soft_ask_service.dart';
import 'package:viro_team_v2/services/push_notification_service.dart';
import 'package:viro_team_v2/services/retour_user_service.dart';
import 'package:viro_team_v2/services/team_service.dart';
import 'package:viro_team_v2/services/theme_preference_service.dart';
import 'package:viro_team_v2/services/chat_service.dart';
import 'package:viro_team_v2/services/chat_messages_local_cache.dart';
import 'package:viro_team_v2/services/user_avatar_storage.dart';
import 'package:viro_team_v2/services/conversation_avatar_storage.dart';
import 'package:viro_team_v2/services/user_service.dart';

/// Surchargé dans `main` avec l'instance démarrée selon le consentement.
final analyticsServiceProvider = Provider<AnalyticsService>(
  (ref) => AnalyticsService(),
);

/// Surchargé dans `main` avec des préférences préchargées (consentement connu
/// avant l'init PostHog).
final analyticsConsentServiceProvider = Provider<AnalyticsConsentService>(
  (ref) => AnalyticsConsentService(),
);

final feePaymentAnalyticsProvider = Provider<FeePaymentAnalytics>(
  (ref) => FeePaymentAnalytics(analytics: ref.watch(analyticsServiceProvider)),
);

final authServiceProvider = Provider<AuthService>((ref) => AuthService());

final accountServiceProvider =
    Provider<AccountService>((ref) => AccountService());

final userAvatarStorageProvider =
    Provider<UserAvatarStorage>((ref) => UserAvatarStorage());

final conversationAvatarStorageProvider =
    Provider<ConversationAvatarStorage>((ref) => ConversationAvatarStorage());

final userServiceProvider = Provider<UserService>((ref) => UserService());

final pushNotificationServiceProvider = Provider<PushNotificationService>(
  (ref) => PushNotificationService(),
);

final notificationPermissionServiceProvider =
    Provider<NotificationPermissionService>(
  (ref) => NotificationPermissionService(),
);

final notificationSoftAskServiceProvider = Provider<NotificationSoftAskService>(
  (ref) => NotificationSoftAskService(),
);


final clubServiceProvider = Provider<ClubService>((ref) => ClubService());

final equipmentServiceProvider =
    Provider<EquipmentService>((ref) => EquipmentService());

final eventServiceProvider = Provider<EventService>((ref) => EventService());

final invitationServiceProvider = Provider<InvitationService>(
  (ref) => InvitationService(),
);

final joinRequestServiceProvider = Provider<JoinRequestService>(
  (ref) => JoinRequestService(),
);

final retourUserServiceProvider = Provider<RetourUserService>(
  (ref) => RetourUserService(),
);

final appUpdateServiceProvider = Provider<AppUpdateService>(
  (ref) => AppUpdateService(),
);

final memberServiceProvider = Provider<MemberService>((ref) => MemberService());

final memberInviteServiceProvider = Provider<MemberInviteService>(
  (ref) => MemberInviteService(),
);

final teamServiceProvider = Provider<TeamService>((ref) => TeamService());

final chatServiceProvider = Provider<ChatService>((ref) => ChatService());

final chatMessagesLocalCacheProvider = Provider<ChatMessagesLocalCache>(
  (ref) => ChatMessagesLocalCache(),
);

final announcementServiceProvider = Provider<AnnouncementService>(
  (ref) => AnnouncementService(),
);

final feeServiceProvider = Provider<FeeService>((ref) => FeeService());

final clubActivityServiceProvider = Provider<ClubActivityService>(
  (ref) => ClubActivityService(),
);

final paymentServiceProvider = Provider<PaymentService>(
  (ref) => StripePaymentService(
    analytics: ref.watch(feePaymentAnalyticsProvider),
  ),
);

final guardianServiceProvider = Provider<GuardianService>(
  (ref) => GuardianService(),
);

final portalBannerPrefsServiceProvider = Provider<PortalBannerPrefsService>(
  (ref) => PortalBannerPrefsService(),
);

/// Surchargé dans `main` avec des préférences préchargées (thème connu dès
/// la première frame).
final themePreferenceServiceProvider = Provider<ThemePreferenceService>(
  (ref) => ThemePreferenceService(),
);
