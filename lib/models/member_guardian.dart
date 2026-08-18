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
  });

  final String? parentUid;
  final String? status;
  final String? displayName;
  final String? email;
  final String? invitationId;
  final String? invitationCode;

  bool get hasOccupant =>
      status == GuardianStatuses.active || status == GuardianStatuses.pending;

  bool get isPending => status == GuardianStatuses.pending;

  bool get isActive => status == GuardianStatuses.active;
}
