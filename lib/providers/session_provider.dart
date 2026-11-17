import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';

/// Session club : club actif.
///
/// Les droits du compte dans ce club ne vivent pas ici : ils se lisent via
/// `clubAccessProvider(clubId)` (fiche `members/{uid}.permissions`). Le lien
/// parent n’est pas un droit ; la cible des actions (Moi vs enfant) vit dans
/// `clubAudienceSelectionProvider`.
class SessionState {
  const SessionState({this.activeClubId});

  final String? activeClubId;

  bool get hasActiveClub =>
      activeClubId != null && activeClubId!.isNotEmpty;
}

class SessionNotifier extends Notifier<SessionState> {
  /// Session vide, recréée à chaque changement de compte (déconnexion,
  /// autre uid) : le compte suivant n'hérite jamais du club du précédent.
  @override
  SessionState build() {
    ref.watch(authUidProvider);
    return const SessionState();
  }

  /// Active un club.
  void setActiveClub(String clubId) {
    state = SessionState(activeClubId: clubId);
  }

  void clear() {
    state = const SessionState();
  }
}

final sessionProvider =
    NotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);
