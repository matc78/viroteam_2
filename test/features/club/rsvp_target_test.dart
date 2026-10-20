import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';

void main() {
  const parentUid = 'parent-uid';
  const childMemberId = 'child1';

  const childMember = ClubMember(
    memberId: childMemberId,
    role: MemberRoles.player,
    status: 'active',
  );

  const childTarget = FamilyAudienceTarget(
    memberId: childMemberId,
    label: 'Léo',
    kind: FamilyAudienceKind.child,
  );

  const selfTarget = FamilyAudienceTarget(
    memberId: 'self',
    label: 'Moi',
    kind: FamilyAudienceKind.self,
  );

  group('childRsvpTarget', () {
    test('null sans sélection', () {
      expect(
        childRsvpTarget(selected: null, childMember: childMember),
        isNull,
      );
    });

    test('null quand la cible est Moi', () {
      expect(
        childRsvpTarget(selected: selfTarget, childMember: null),
        isNull,
      );
    });

    test('enfant sélectionné : memberId enfant + callable', () {
      final target =
          childRsvpTarget(selected: childTarget, childMember: childMember)!;
      expect(target.subjectId, childMemberId);
      expect(target.audienceId, childMemberId);
      expect(target.member, childMember);
      expect(target.viaCallable, isTrue);
    });

    test('statut lu sur la clé de l’enfant, pas celle du parent', () {
      final event = ClubEvent(
        id: 'e1',
        clubId: 'club1',
        type: EventTypes.training,
        title: 'Entraînement',
        date: DateTime(2026, 10, 20),
        teamMemberIds: const [parentUid, childMemberId],
        rsvp: const {parentUid: 'no', childMemberId: 'yes'},
      );
      final target =
          childRsvpTarget(selected: childTarget, childMember: childMember)!;

      expect(
        event.rsvpStatusForUser(
          target.subjectId,
          clubAudienceId: target.audienceId,
          memberAudienceKeys: eventAudienceKeys(childMember),
        ),
        RsvpStatus.yes,
      );
    });
  });
}
