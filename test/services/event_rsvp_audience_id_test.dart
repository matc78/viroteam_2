import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';

void main() {
  group('RSVP / convocation : clé unique = id de la fiche', () {
    const authUid = 'VsTt-auth';

    const linkedMember = ClubMember(
      memberId: authUid,
      accountUid: authUid,
      role: MemberRoles.player,
      status: 'active',
    );

    ClubEvent event({
      List<String> teamMemberIds = const [authUid],
      List<String> excludedMemberIds = const [],
      Map<String, String> rsvp = const {},
    }) =>
        ClubEvent(
          id: 'e1',
          clubId: 'c1',
          type: EventTypes.training,
          title: 'Entraînement',
          date: DateTime(2026, 11, 4),
          teamMemberIds: teamMemberIds,
          excludedMemberIds: excludedMemberIds,
          rsvp: rsvp,
        );

    test('statut et convocation lus sous l’uid du compte connecté', () {
      final e = event(rsvp: const {authUid: 'yes', 'autre': 'no'});
      expect(e.rsvpStatusForUser(authUid), RsvpStatus.yes);
      expect(e.isInvitedAsPlayer(authUid), isTrue);
      expect(e.isInvitedAsPlayer('autre'), isFalse);
    });

    test('joueur retiré par le coach : plus convoqué', () {
      final e = event(
        teamMemberIds: const [],
        excludedMemberIds: const [authUid],
      );
      expect(isConvokedOnEvent(e, linkedMember), isFalse);
      expect(isConvokedOnEvent(event(), linkedMember), isTrue);
    });

    test('dedupedPlayerMemberIds : sans coachs ni doublons', () {
      final e = event(teamMemberIds: const [authUid, 'coach', authUid, 'p2']);
      expect(
        dedupedPlayerMemberIds(event: e, excludeCoachUids: const {'coach'}),
        [authUid, 'p2'],
      );
    });
  });
}
