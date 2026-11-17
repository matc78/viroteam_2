import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  @override
  SessionState build() => const SessionState();

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
