import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_form_controller.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
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

    test('match : décoché / recoché, remis à zéro au changement d’équipe', () {
      final form = AddEventFormController(initialDate: DateTime(2026, 10, 23))
        ..onTypeChanged(EventTypes.match)
        ..setTeamId('u13')
        ..togglePlayerConvoked('mem-a');
      expect(form.excludedPlayerIds, {'mem-a'});

      form.togglePlayerConvoked('mem-a');
      expect(form.excludedPlayerIds, isEmpty);

      form
        ..togglePlayerConvoked('mem-a')
        ..setTeamId('u15');
      expect(form.excludedPlayerIds, isEmpty);
      form.dispose();
    });

    test('match : au moins un joueur convoqué', () {
      const club = Club(id: 'c1', name: 'Club', sport: 'football');
      final form = AddEventFormController(initialDate: DateTime(2026, 10, 23))
        ..onTypeChanged(EventTypes.match)
        ..setTeamId('u13')
        ..togglePlayerConvoked('mem-a')
        ..togglePlayerConvoked('mem-b');

      expect(
        form.validationMessage(club, matchPlayerIds: ['mem-a', 'mem-b']),
        AppCopy.planning.keepOnePlayerConvoked,
      );
      expect(form.canCreate(club, matchPlayerIds: ['mem-a', 'mem-b']), isFalse);

      form.togglePlayerConvoked('mem-b');
      expect(
        form.validationMessage(club, matchPlayerIds: ['mem-a', 'mem-b']),
        isNot(AppCopy.planning.keepOnePlayerConvoked),
      );
      form.dispose();
    });
  });

  group('teamPlayerEntries', () {
    test('joueurs dédupliqués (memberId + uid) et triés par nom', () {
      final members = [
        const ClubMember(
          memberId: 'mem-z',
          role: MemberRoles.player,
          status: 'active',
          firstName: 'Zoé',
        ),
        const ClubMember(
          memberId: 'mem-a',
          accountUid: 'uid-a',
          role: MemberRoles.player,
          status: 'active',
          firstName: 'Adam',
        ),
      ];
      final entries = teamPlayerEntries(
        [
          _team('u13', ['mem-z', 'uid-a', 'mem-a', 'inconnu']),
        ],
        indexClubMembersByUid(members),
      );
      expect(entries.map((e) => e.id), ['mem-a', 'mem-z']);
    });
  });

  group('ClubEvent.isExcludedFor', () {
    test('vrai si une des clés du joueur est retirée', () {
      final event = ClubEvent(
        id: 'e1',
        clubId: 'c1',
        type: EventTypes.match,
        title: 'U13',
        date: DateTime(2026, 10, 25),
        excludedMemberIds: const ['mem-a'],
      );
      expect(event.isExcludedFor({'uid-a', 'mem-a'}), isTrue);
      expect(event.isExcludedFor({'mem-b'}), isFalse);
    });
  });
}
