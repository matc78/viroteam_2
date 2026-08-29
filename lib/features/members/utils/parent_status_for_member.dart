import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/services/member_service.dart';

/// Statut du lien parent pour un joueur (vue admin liste membres).
enum ParentLinkStatus {
  none,
  pending,
  active,
}

/// Construit une map `memberId` → statut parent à partir de la liste club-wide.
Map<String, ParentLinkStatus> buildParentStatusByMemberId(
  List<ClubParentEntry> parents,
) {
  final statusByMemberId = <String, ParentLinkStatus>{};

  for (final parent in parents) {
    for (final child in parent.children) {
      final nextStatus = _statusFromGuardian(child.status);
      if (nextStatus == ParentLinkStatus.none) continue;

      final currentStatus = statusByMemberId[child.memberId];
      if (currentStatus == ParentLinkStatus.active) continue;
      if (nextStatus == ParentLinkStatus.active || currentStatus == null) {
        statusByMemberId[child.memberId] = nextStatus;
      }
    }
  }

  return statusByMemberId;
}

ParentLinkStatus _statusFromGuardian(String status) {
  if (status == GuardianStatuses.active) return ParentLinkStatus.active;
  if (status == GuardianStatuses.pending) return ParentLinkStatus.pending;
  return ParentLinkStatus.none;
}
