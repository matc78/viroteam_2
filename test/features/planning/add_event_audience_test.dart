import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_form_controller.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';

ClubMember _member(String memberId, {String? accountUid}) => ClubMember(
  memberId: memberId,
  accountUid: accountUid,
  role: MemberRoles.player,
  status: 'active',
);

ClubTeam _team(String id, List<String> playerIds) =>
    ClubTeam(id: id, clubId: 'c1', name: id, playerIds: playerIds);

void main() {
  group('addEventAudienceForTeams', () {
    final members = [
      _member('mem-a', accountUid: 'uid-a'),
      _member('mem-b'),
      _member('mem-sans-equipe'),
    ];
    final teams = [
      _team('u13', ['uid-a']),
      _team('u15', ['mem-b']),
    ];

    test('équipes choisies : seulement leurs convoqués', () {
      expect(addEventAudienceForTeams([teams.first], members), ['mem-a']);
    });

    test('tout le club : aussi les membres sans équipe, sans doublon', () {
      final audience = addEventAudienceForTeams(
        teams,
        members,
        wholeClub: true,
      );
      expect(audience.toSet(), {'mem-a', 'mem-b', 'mem-sans-equipe'});
      expect(audience.length, 3);
    });
  });

  group('AddEventFormController convoqués', () {
    test('réunion : tout le club par défaut, une équipe exigée sinon', () {
      final form = AddEventFormController(initialDate: DateTime(2026, 10, 23))
        ..onTypeChanged(EventTypes.meeting)
        ..locationController.text = 'Club-house';
      const club = Club(id: 'c1', name: 'Club', sport: 'football');

      expect(form.audienceWholeClub, isTrue);
      expect(form.validationMessage(club), isNull);

      form.setAudienceWholeClub(false);
      expect(form.canCreate(club), isFalse);
      expect(form.validationMessage(club), isNotNull);

      form.toggleAudienceTeam('u13');
      expect(form.validationMessage(club), isNull);
      form.dispose();
    });
  });
}
