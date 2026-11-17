import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/planning/utils/planning_rsvp_badge.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

ClubEvent _event({List<String> teamIds = const [], bool allTeams = false}) =>
    ClubEvent(
      id: 'e1',
      clubId: 'c1',
      title: 'Match',
      type: EventTypes.match,
      date: DateTime(2026, 11, 20),
      teamIds: teamIds,
      allTeams: allTeams,
    );

const _admin = ClubMember(
  memberId: 'a',
  status: 'active',
  permissions: {ClubPermission.admin},
);

const _player = ClubMember(memberId: 'p', status: 'active', teamIds: ['t1']);

void main() {
  group('isSpecialClubEvent', () {
    test('tout le club ou sans équipe', () {
      expect(isSpecialClubEvent(_event(allTeams: true, teamIds: ['t1'])), isTrue);
      expect(isSpecialClubEvent(_event()), isTrue);
      expect(isSpecialClubEvent(_event(teamIds: ['t1'])), isFalse);
    });
  });

  group('planningRsvpRowBadge', () {
    test('événement d’équipe : Entraîneur seulement, jamais Admin', () {
      final event = _event(teamIds: ['t1']);
      expect(
        planningRsvpRowBadge(
          event: event,
          member: _admin,
          coachesEventTeam: false,
        ),
        isNull,
      );
      expect(
        planningRsvpRowBadge(
          event: event,
          member: _admin,
          coachesEventTeam: true,
        ),
        ViroRole.coach,
      );
      expect(
        planningRsvpRowBadge(
          event: event,
          member: _player,
          coachesEventTeam: false,
        ),
        isNull,
      );
    });

    test('événement spécial : Admin si droit admin, sinon comme une équipe', () {
      final event = _event(allTeams: true, teamIds: ['t1']);
      expect(
        planningRsvpRowBadge(
          event: event,
          member: _admin,
          coachesEventTeam: true,
        ),
        ViroRole.admin,
      );
      expect(
        planningRsvpRowBadge(
          event: _event(),
          member: _admin,
          coachesEventTeam: false,
        ),
        ViroRole.admin,
      );
      expect(
        planningRsvpRowBadge(
          event: event,
          member: _player,
          coachesEventTeam: true,
        ),
        ViroRole.coach,
      );
      expect(
        planningRsvpRowBadge(
          event: event,
          member: _player,
          coachesEventTeam: false,
        ),
        isNull,
      );
    });
  });
}
