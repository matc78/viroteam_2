import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/utils/invite_message.dart';

void main() {
  group('generateInviteCode', () {
    test('produit un code de 6 caractères uppercase', () {
      final code = generateInviteCode();
      expect(code.length, 6);
      expect(code, code.toUpperCase());
      expect(code, matches(RegExp(r'^[A-Z2-9]+$')));
    });
  });

  group('buildInviteMessage', () {
    test('inclut club, code, stores et espace club', () {
      const club = Club(
        id: 'club1',
        name: 'ASM Volley',
        sport: 'Volleyball',
      );
      const invitation = ClubInvitation(
        id: 'inv1',
        clubId: 'club1',
        code: 'ABC123',
        role: MemberRoles.player,
        status: InvitationStatus.pending,
      );

      final message = buildInviteMessage(club: club, invitation: invitation);

      expect(message, contains('ASM Volley'));
      expect(message, contains('ABC123'));
      expect(message, contains('7 jours'));
      expect(message, contains(ProjectConfig.appStoreUrl));
      expect(message, contains(ProjectConfig.playStoreUrl));
      expect(message, contains(ProjectConfig.siteUrl));
      expect(message, contains('Espace club :'));
      expect(message, contains('join?code=ABC123'));
      expect(message, isNot(contains('Lien :')));
    });
  });

  group('buildGuardianInviteMessage', () {
    test('inclut stores et espace club', () {
      const club = Club(
        id: 'club1',
        name: 'ASM Volley',
        sport: 'Volleyball',
      );

      final message = buildGuardianInviteMessage(
        club: club,
        code: 'PAR001',
        childFirstName: 'Tom',
      );

      expect(message, contains('Tom'));
      expect(message, contains('ASM Volley'));
      expect(message, contains(ProjectConfig.appStoreUrl));
      expect(message, contains(ProjectConfig.playStoreUrl));
      expect(message, contains('Espace club :'));
      expect(message, contains('join?code=PAR001'));
    });
  });
}
