import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/services/member/member_activation.dart';

ClubMember _member(
  String id, {
  bool linked = false,
  String? email,
  String? inviteCode,
  DateTime? inviteExpiresAt,
}) => ClubMember(
  memberId: id,
  status: 'active',
  accountUid: linked ? id : null,
  hasLinkedAccount: linked,
  email: email,
  pendingInviteCode: inviteCode,
  pendingInviteExpiresAt: inviteExpiresAt,
);

void main() {
  final future = DateTime.now().add(const Duration(days: 3));
  final past = DateTime.now().subtract(const Duration(days: 1));

  group('memberActivationBucket', () {
    test('accountUid suffit (profil du compte illisible), comme le portail', () {
      expect(
        memberActivationBucket(
          const ClubMember(memberId: 'u', status: 'active', accountUid: 'u'),
        ),
        MemberActivationBucket.linked,
      );
    });

    test('compte lié, même avec e-mail et code', () {
      expect(
        memberActivationBucket(
          _member('a', linked: true, email: 'a@x.fr', inviteCode: 'ABC'),
        ),
        MemberActivationBucket.linked,
      );
    });

    test('sans e-mail (vide ou blanc)', () {
      expect(
        memberActivationBucket(_member('b')),
        MemberActivationBucket.noEmail,
      );
      expect(
        memberActivationBucket(_member('b', email: '  ')),
        MemberActivationBucket.noEmail,
      );
    });

    test('invitation valide → en cours ; expirée → à inviter', () {
      expect(
        memberActivationBucket(
          _member(
            'c',
            email: 'c@x.fr',
            inviteCode: 'ABC',
            inviteExpiresAt: future,
          ),
        ),
        MemberActivationBucket.pendingInvite,
      );
      expect(
        memberActivationBucket(
          _member(
            'c',
            email: 'c@x.fr',
            inviteCode: 'ABC',
            inviteExpiresAt: past,
          ),
        ),
        MemberActivationBucket.toInvite,
      );
      expect(
        memberActivationBucket(_member('d', email: 'd@x.fr')),
        MemberActivationBucket.toInvite,
      );
    });
  });

  group('MemberActivationStats', () {
    test('compte chaque étape et le pourcentage de comptes liés', () {
      final stats = MemberActivationStats.of([
        _member('1', linked: true),
        _member('2', linked: true),
        _member('3', email: 'x@x.fr'),
        _member('4'),
      ]);
      expect(stats.total, 4);
      expect(stats.linked, 2);
      expect(stats.count(MemberActivationBucket.toInvite), 1);
      expect(stats.count(MemberActivationBucket.noEmail), 1);
      expect(stats.count(MemberActivationBucket.pendingInvite), 0);
      expect(stats.linkedPercent, 50);
      expect(stats.allLinked, isFalse);
    });

    test('effectif vide : 0 % et rien de « tout lié »', () {
      final stats = MemberActivationStats.of(const []);
      expect(stats.linkedPercent, 0);
      expect(stats.allLinked, isFalse);
    });
  });
}
