import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Vue V1 du parent d’une fiche joueur (0 ou 1 occupant).
class MemberGuardianView {
  const MemberGuardianView({
    this.parentUid,
    this.status,
    this.displayName,
    this.email,
    this.invitationId,
    this.invitationCode,
    this.expiresAt,
  });

  final String? parentUid;
  final String? status;
  final String? displayName;
  final String? email;
  final String? invitationId;
  final String? invitationCode;
  final DateTime? expiresAt;

  bool get hasOccupant =>
      status == GuardianStatuses.active || status == GuardianStatuses.pending;

  bool get isPending => status == GuardianStatuses.pending;

  bool get isActive => status == GuardianStatuses.active;

  /// Invitation pending dont la date d’expiration est dépassée.
  bool get inviteExpired =>
      isPending &&
      expiresAt != null &&
      expiresAt!.isBefore(DateTime.now());
}
