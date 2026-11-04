import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';

void main() {
  group('rosterAudienceId / RSVP dual-key', () {
    const authUid = 'VsTt-auth';
    const memberId = 'TfRU-member';

    final linkedMember = ClubMember(
      memberId: memberId,
      accountUid: authUid,
      role: MemberRoles.player,
      status: 'active',
    );

    test('rosterAudienceId préfère accountUid', () {
      expect(rosterAudienceId(linkedMember), authUid);
    });

    test('rsvpStatusForUser lit la clé présente dans teamMemberIds en premier', () {
      final event = ClubEvent(
        id: 'e1',
        clubId: 'c1',
        type: EventTypes.training,
        title: 'Entraînement',
        date: DateTime(2026, 11, 4),
        teamMemberIds: const [authUid],
        rsvp: const {authUid: 'yes', memberId: 'no'},
      );

      expect(
        event.rsvpStatusForUser(
          authUid,
          clubAudienceId: authUid,
          memberAudienceKeys: eventAudienceKeys(linkedMember),
        ),
        RsvpStatus.yes,
      );
    });

    test('après nettoyage legacy, le statut suit la clé canonique', () {
      final event = ClubEvent(
        id: 'e1',
        clubId: 'c1',
        type: EventTypes.training,
        title: 'Entraînement',
        date: DateTime(2026, 11, 4),
        teamMemberIds: const [authUid],
        rsvp: const {authUid: 'no'},
      );

      expect(
        event.rsvpStatusForUser(
          authUid,
          clubAudienceId: authUid,
          memberAudienceKeys: eventAudienceKeys(linkedMember),
        ),
        RsvpStatus.no,
      );
    });
  });
}
