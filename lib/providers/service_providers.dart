import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/services/analytics_service.dart';
import 'package:viro_team_v2/services/account_service.dart';
import 'package:viro_team_v2/services/announcement_service.dart';
import 'package:viro_team_v2/services/auth_service.dart';
import 'package:viro_team_v2/services/club_service.dart';
import 'package:viro_team_v2/services/equipment_service.dart';
import 'package:viro_team_v2/services/event_service.dart';
import 'package:viro_team_v2/services/fee_service.dart';
import 'package:viro_team_v2/services/guardian_service.dart';
import 'package:viro_team_v2/services/invitation_service.dart';
import 'package:viro_team_v2/services/join_request_service.dart';
import 'package:viro_team_v2/services/member_invite_service.dart';
import 'package:viro_team_v2/services/member_service.dart';
import 'package:viro_team_v2/services/portal_banner_prefs_service.dart';
import 'package:viro_team_v2/services/payment/payment_service.dart';
import 'package:viro_team_v2/services/retour_user_service.dart';
import 'package:viro_team_v2/services/team_service.dart';
import 'package:viro_team_v2/services/user_avatar_storage.dart';
import 'package:viro_team_v2/services/user_service.dart';

final analyticsServiceProvider = Provider<AnalyticsService>(
  (ref) => AnalyticsService(),
);

final authServiceProvider = Provider<AuthService>((ref) => AuthService());

final accountServiceProvider =
    Provider<AccountService>((ref) => AccountService());

final userAvatarStorageProvider =
    Provider<UserAvatarStorage>((ref) => UserAvatarStorage());

final userServiceProvider = Provider<UserService>((ref) => UserService());


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

final memberServiceProvider = Provider<MemberService>((ref) => MemberService());

final memberInviteServiceProvider = Provider<MemberInviteService>(
  (ref) => MemberInviteService(),
);

final teamServiceProvider = Provider<TeamService>((ref) => TeamService());

final announcementServiceProvider = Provider<AnnouncementService>(
  (ref) => AnnouncementService(),
);

final feeServiceProvider = Provider<FeeService>((ref) => FeeService());

final paymentServiceProvider = Provider<PaymentService>(
  (ref) => HelloAssoPaymentService(),
);

final guardianServiceProvider = Provider<GuardianService>(
  (ref) => GuardianService(),
);

final portalBannerPrefsServiceProvider = Provider<PortalBannerPrefsService>(
  (ref) => PortalBannerPrefsService(),
);
