import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/announcements/announcement_target_types.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/models/club_announcement.dart';
import 'package:viro_team_v2/models/club_membership_summary.dart';
import 'package:viro_team_v2/models/parent_link.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/services/announcement_service.dart';

void main() {
  group('ViroUser.isGuardianOnlyInClub', () {
    const activeLink = ParentLink(
      clubId: 'club1',
      memberId: 'child1',
      relation: 'parent',
      status: 'active',
    );

    ViroUser user({
      List<ClubMembershipSummary> memberships = const [],
      List<ParentLink> links = const [],
    }) =>
        ViroUser(
          uid: 'parent',
          email: 'p@viro.team',
          emailNorm: 'p@viro.team',
          firstName: 'Paul',
          lastName: 'Parent',
          displayName: 'Paul Parent',
          clubMemberships: memberships,
          parentLinks: links,
        );

    test('true : lien actif sans fiche membre', () {
      expect(user(links: [activeLink]).isGuardianOnlyInClub('club1'), isTrue);
    });

    test('false : licencié du club (même avec un enfant)', () {
      final licensed = user(
        memberships: const [ClubMembershipSummary(clubId: 'club1', role: 'player')],
        links: [activeLink],
      );
      expect(licensed.isGuardianOnlyInClub('club1'), isFalse);
    });

    test('false : lien pending ou autre club', () {
      const pending = ParentLink(
        clubId: 'club1',
        memberId: 'child1',
        relation: 'parent',
        status: 'pending',
      );
      expect(user(links: [pending]).isGuardianOnlyInClub('club1'), isFalse);
      expect(user(links: [activeLink]).isGuardianOnlyInClub('club2'), isFalse);
    });
  });

  group('mergeChildTeamIds', () {
    test('union sans doublon, ignore null et vides', () {
      final merged = mergeChildTeamIds([
        ['t1', 't2'],
        null,
        ['t2', '', 't3'],
      ]);
      expect(merged, unorderedEquals(['t1', 't2', 't3']));
    });

    test('vide si aucune fiche', () {
      expect(mergeChildTeamIds(const []), isEmpty);
    });
  });

  group('AnnouncementService.mergeGuardianAnnouncements', () {
    ClubAnnouncement announcement(String id, int minutesAgo) => ClubAnnouncement(
          id: id,
          clubId: 'club1',
          senderId: 'coach',
          senderFirstName: 'Léa',
          senderLastName: 'Coach',
          message: 'msg $id',
          createdAt: DateTime(2026, 9, 1, 12).subtract(
            Duration(minutes: minutesAgo),
          ),
          targetType: AnnouncementTargetTypes.equipes,
          targetIds: const ['t1'],
        );

    test('dédoublonne (même annonce renvoyée par deux requêtes équipe)', () {
      final merged = AnnouncementService.mergeGuardianAnnouncements([
        announcement('a', 10),
        announcement('a', 10),
        announcement('b', 5),
      ]);
      expect(merged.map((a) => a.id), ['b', 'a']);
    });

    test('trie par createdAt décroissant et tronque à limit', () {
      final merged = AnnouncementService.mergeGuardianAnnouncements(
        [announcement('old', 60), announcement('new', 1), announcement('mid', 30)],
        limit: 2,
      );
      expect(merged.map((a) => a.id), ['new', 'mid']);
    });
  });
}
