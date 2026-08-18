import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Session club : club actif + rôle **membre** (player / coach / admin).
///
/// Le lien parent n’est pas un rôle Firestore. La cible des actions
/// (Moi vs enfant) vit dans `clubAudienceSelectionProvider`.
class SessionState {
  const SessionState({
    this.activeClubId,
    this.activeRole,
  });

  final String? activeClubId;

  /// Rôle club `player` | `coach` | `admin`, jamais parent.
  final String? activeRole;

  bool get hasActiveClub =>
      activeClubId != null && activeClubId!.isNotEmpty;

  SessionState copyWith({
    String? activeClubId,
    String? activeRole,
    bool clearClub = false,
    bool clearRole = false,
  }) {
    return SessionState(
      activeClubId: clearClub ? null : (activeClubId ?? this.activeClubId),
      activeRole: clearRole ? null : (activeRole ?? this.activeRole),
    );
  }
}

class SessionNotifier extends Notifier<SessionState> {
  @override
  SessionState build() => const SessionState();

  /// Active un club. [role] = adhésion membre uniquement (`null` si parent seul).
  void setActiveClub(String clubId, {String? role}) {
    final memberRole = role == null || role.isEmpty
        ? null
        : memberRoleToViroRole(role);
    state = SessionState(activeClubId: clubId, activeRole: memberRole);
  }

  void setActiveRole(String role) {
    state = state.copyWith(activeRole: memberRoleToViroRole(role));
  }

  void clear() {
    state = const SessionState();
  }
}

final sessionProvider =
    NotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);

String memberRoleToViroRole(String role) => switch (role) {
      MemberRoles.admin => 'admin',
      MemberRoles.coach => 'coach',
      MemberRoles.player => 'player',
      _ => 'player',
    };
