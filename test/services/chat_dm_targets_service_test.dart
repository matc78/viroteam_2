import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/services/chat/chat_dm_targets_service.dart';

/// Fiche liée : id = uid Auth ; [linked] à `false` → fiche sans compte.
ClubMember _member(
  String memberId, {
  bool linked = true,
  String role = MemberRoles.coach,
  String? firstName,
  String? lastName,
}) =>
    ClubMember(
      memberId: memberId,
      accountUid: linked ? memberId : null,
      role: role,
      status: 'active',
      firstName: firstName,
      lastName: lastName,
    );

ClubTeam _team(String id, List<String> coachIds) =>
    ClubTeam(id: id, clubId: 'club', name: id, coachIds: coachIds);

void main() {
  group('collectChatDmRosterIds', () {
    test('admins club, coaches des équipes puis fiches admin, sans doublon',
        () {
      final ids = collectChatDmRosterIds(
        clubAdminIds: const ['adminAuth'],
        callerTeams: [
          _team('t1', const ['coachA', ' ', 'coachB']),
          _team('t2', const ['coachB']),
        ],
        members: [
          _member('adminAuth', role: MemberRoles.admin),
          _member('m-admin2', linked: false, role: MemberRoles.admin),
          _member('p', role: MemberRoles.player),
        ],
      );

      expect(ids.toList(), ['adminAuth', 'coachA', 'coachB', 'm-admin2']);
    });
  });

  group('indexChatDmMembers', () {
    test('indexe par id de fiche', () {
      final coach = _member('auth1');
      final index = indexChatDmMembers([coach, _member('m2', linked: false)]);

      expect(index['auth1'], same(coach));
      expect(index.containsKey('m2'), isTrue);
      expect(index, hasLength(2));
    });
  });

  group('chunkIds', () {
    test('découpe par paquets de la taille demandée', () {
      final ids = List.generate(65, (i) => 'id$i');
      final chunks = chunkIds(ids, 30);

      expect(chunks.map((c) => c.length).toList(), [30, 30, 5]);
      expect(chunks.expand((c) => c).toList(), ids);
    });

    test('vide → aucun paquet', () {
      expect(chunkIds(const [], 30), isEmpty);
    });
  });

  group('buildChatDmTargets', () {
    test('une cible par compte, hors caller et fiches sans compte, triée', () {
      final zoe = _member('zoe', firstName: 'zoé');
      final alex = _member('alex', firstName: 'Alex', role: MemberRoles.admin);
      final me = _member('me', firstName: 'Moi');
      final noAccount = _member('m-ghost', linked: false, firstName: 'Ghost');
      final memberByKey = indexChatDmMembers([zoe, alex, me, noAccount]);

      final targets = buildChatDmTargets(
        // `alex` présent deux fois (admin club + coach) → une seule cible.
        rosterIds: const ['zoe', 'alex', 'alex', 'me', 'm-ghost', 'inconnu'],
        memberByKey: memberByKey,
        callerUid: 'me',
      );

      expect(targets.map((t) => t.uid).toList(), ['alex', 'zoe']);
      expect(targets.first.label, 'Alex');
      expect(targets.first.role, MemberRoles.admin);
      expect(targets.first.member, same(alex));
    });

    test('libellé de repli quand la fiche n’a pas de nom', () {
      final targets = buildChatDmTargets(
        rosterIds: const ['anon'],
        memberByKey: indexChatDmMembers([_member('anon')]),
        callerUid: 'me',
      );

      expect(targets.single.label, AppCopy.members.unnamed);
    });
  });
}
