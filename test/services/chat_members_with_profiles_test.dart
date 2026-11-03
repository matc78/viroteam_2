import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/services/chat/chat_helpers.dart';

void main() {
  group('chatMembersWithProfiles', () {
    const coachProfile = ChatParticipantProfile(
      role: MemberRoles.coach,
      firstName: 'Léa',
      lastName: 'Martin',
      displayName: 'Léa Martin',
      avatarUrl: 'https://example.com/lea.jpg',
    );

    test('sans fiche lisible (parent) : une fiche par profil', () {
      final members = chatMembersWithProfiles(
        members: const [],
        profiles: const {'coach-uid': coachProfile},
      );
      expect(members, hasLength(1));
      final coach = members.single;
      expect(coach.accountUid, 'coach-uid');
      expect(coach.role, MemberRoles.coach);
      expect(coach.fullName, 'Léa Martin');
      expect(coach.avatarUrl, 'https://example.com/lea.jpg');
    });

    test('une fiche membre lisible reste prioritaire', () {
      const member = ClubMember(
        memberId: 'm1',
        accountUid: 'coach-uid',
        role: MemberRoles.admin,
        status: 'active',
        firstName: 'Léa',
      );
      final members = chatMembersWithProfiles(
        members: const [member],
        profiles: const {'coach-uid': coachProfile},
      );
      expect(members, [member]);
    });

    test('profil sans nom : pas de nom vide inventé', () {
      final members = chatMembersWithProfiles(
        members: const [],
        profiles: const {
          'parent-uid': ChatParticipantProfile(role: 'parent'),
        },
      );
      expect(members.single.firstName, isNull);
      expect(members.single.displayName, isNull);
    });
  });

  group('ChatParticipantProfile.fromMap', () {
    test('lit les champs et ignore un avatar vide', () {
      final profile = ChatParticipantProfile.fromMap({
        'firstName': ' Sam ',
        'role': 'parent',
        'avatarUrl': '',
        'displayName': 42,
      });
      expect(profile.firstName, 'Sam');
      expect(profile.role, 'parent');
      expect(profile.avatarUrl, isNull);
      expect(profile.displayName, '');
    });
  });
}
