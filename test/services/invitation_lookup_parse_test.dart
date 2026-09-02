import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/services/invitation_service.dart';

void main() {
  final futureExpiry =
      DateTime.now().add(const Duration(days: 3)).toUtc().toIso8601String();

  Map<String, dynamic> foundResponse({Map<String, dynamic>? overrides}) => {
        'found': true,
        'invitation': {
          'clubId': 'club42',
          'invitationId': 'inv7',
          'code': 'ABC123',
          'role': 'coach',
          'type': 'member',
          'status': 'pending',
          'firstName': 'Marie',
          'lastName': 'Curie',
          'emailHint': 'm•••@gmail.com',
          'clubName': 'Viro Handball',
          'clubSport': 'Handball',
          'memberId': 'member9',
          'expiresAt': futureExpiry,
          ...?overrides,
        },
      };

  group('ClubInvitation.fromLookup', () {
    test('reconstruit l’invitation depuis la réponse de la callable', () {
      final invitation = ClubInvitation.fromLookup(
        Map<String, dynamic>.from(foundResponse()['invitation'] as Map),
      );

      expect(invitation.id, 'inv7');
      expect(invitation.clubId, 'club42');
      expect(invitation.code, 'ABC123');
      expect(invitation.role, MemberRoles.coach);
      expect(invitation.type, InvitationTypes.member);
      expect(invitation.status, InvitationStatus.pending);
      expect(invitation.firstName, 'Marie');
      expect(invitation.lastName, 'Curie');
      expect(invitation.memberId, 'member9');
      expect(invitation.clubName, 'Viro Handball');
      expect(invitation.clubSport, 'Handball');
      expect(invitation.emailHint, 'm•••@gmail.com');
      expect(invitation.email, isNull,
          reason: 'la callable ne renvoie jamais l’e-mail complet');
      expect(invitation.expiresAt, isNotNull);
      expect(invitation.isPending, isTrue);
    });

    test('tolère memberId / expiresAt null', () {
      final invitation = ClubInvitation.fromLookup({
        'clubId': 'club42',
        'invitationId': 'inv7',
        'code': 'ABC123',
        'role': 'player',
        'status': 'pending',
        'memberId': null,
        'expiresAt': null,
      });

      expect(invitation.memberId, isNull);
      expect(invitation.expiresAt, isNull);
      expect(invitation.isPending, isTrue);
    });
  });

  group('InvitationService.parseLookupResponse', () {
    test('retourne invitation + club quand found == true', () {
      final result = InvitationService.parseLookupResponse(foundResponse());

      expect(result, isNotNull);
      expect(result!.club.id, 'club42');
      expect(result.club.name, 'Viro Handball');
      expect(result.club.sport, 'Handball');
      expect(result.invitation.code, 'ABC123');
    });

    test('retourne null quand found == false (introuvable ou expirée)', () {
      expect(InvitationService.parseLookupResponse({'found': false}), isNull);
      expect(
        InvitationService.parseLookupResponse({
          'found': false,
          'reason': 'expired',
        }),
        isNull,
      );
    });

    test('retourne null sur réponse inattendue', () {
      expect(InvitationService.parseLookupResponse(null), isNull);
      expect(InvitationService.parseLookupResponse('oops'), isNull);
      expect(InvitationService.parseLookupResponse({'found': true}), isNull);
      expect(
        InvitationService.parseLookupResponse({
          'found': true,
          'invitation': {'code': 'ABC123'},
        }),
        isNull,
        reason: 'clubId / invitationId manquants',
      );
    });

    test('retourne null si expiresAt est déjà passé', () {
      final expired = DateTime.now()
          .subtract(const Duration(days: 1))
          .toUtc()
          .toIso8601String();
      final result = InvitationService.parseLookupResponse(
        foundResponse(overrides: {'expiresAt': expired}),
      );
      expect(result, isNull);
    });

    test('accepte une invitation parent (type guardian)', () {
      final result = InvitationService.parseLookupResponse(
        foundResponse(overrides: {'type': 'guardian'}),
      );
      expect(result!.invitation.isGuardian, isTrue);
    });
  });
}
