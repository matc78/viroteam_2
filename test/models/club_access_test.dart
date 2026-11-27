import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/models/club_access.dart';
import 'package:viro_team_v2/models/club_permission.dart';

ClubAccess _access({
  Set<ClubPermission> permissions = const {},
  List<String> coachTeamIds = const [],
  CoachPermissions coachPermissions = CoachPermissions.defaults,
}) => ClubAccess(
  permissions: permissions,
  coachTeamIds: coachTeamIds,
  teamIds: coachTeamIds,
  coachPermissions: coachPermissions,
);

void main() {
  group('droits club', () {
    test('admin accorde tout', () {
      final admin = _access(permissions: {ClubPermission.admin});
      expect(admin.isAdmin, isTrue);
      for (final permission in ClubPermission.values) {
        expect(admin.can(permission), isTrue, reason: permission.id);
      }
    });

    test('un droit isolé n’ouvre que lui', () {
      final treasurer = _access(
        permissions: {ClubPermission.manageFees, ClubPermission.viewFees},
      );
      expect(treasurer.can(ClubPermission.manageFees), isTrue);
      expect(treasurer.can(ClubPermission.manageMembers), isFalse);
      expect(treasurer.isAdmin, isFalse);
      expect(treasurer.isStaff, isTrue);
      expect(treasurer.isTeamCoach, isFalse);
    });

    test('« Gérer les membres » : droit membres / équipes ou coach', () {
      expect(_access(coachTeamIds: ['a']).canOpenMembers, isTrue);
      expect(
        _access(permissions: {ClubPermission.manageTeams}).canOpenMembers,
        isTrue,
      );
      expect(
        _access(permissions: {ClubPermission.manageMembers}).canOpenMembers,
        isTrue,
      );
      // Un droit sans rapport (cotisations) n'ouvre pas les membres.
      expect(
        _access(
          permissions: {ClubPermission.manageFees, ClubPermission.viewFees},
        ).canOpenMembers,
        isFalse,
      );
      expect(ClubAccess.none.canOpenMembers, isFalse);
    });

    test('aucun droit ni équipe : rien', () {
      expect(ClubAccess.none.isStaff, isFalse);
      expect(ClubAccess.none.canCreateEvents, isFalse);
      expect(ClubAccess.none.canPublishAnnouncements, isFalse);
    });
  });

  group('coach d’équipe', () {
    final coach = _access(coachTeamIds: ['a']);

    test('agit sur ses équipes seulement', () {
      expect(coach.canCreateEvents, isTrue);
      expect(coach.canManageEvent(['a'], allTeams: false), isTrue);
      expect(coach.canManageEvent(['b'], allTeams: false), isFalse);
      expect(coach.canAddPlayerToTeam('a'), isTrue);
      expect(coach.canAddPlayerToTeam('b'), isFalse);
      expect(coach.canPublishAnnouncementToTeams(['a']), isTrue);
      expect(coach.canPublishAnnouncementToTeams(['a', 'b']), isFalse);
      expect(coach.canWriteStaffChannels, isTrue);
    });

    test('les réglages du club coupent ses capacités', () {
      final restricted = _access(
        coachTeamIds: ['a'],
        coachPermissions: CoachPermissions.defaults
            .withFlag(CoachFlag.canCreateEvents, false)
            .withFlag(CoachFlag.canPublishTeamAnnouncements, false),
      );
      expect(restricted.canCreateEvents, isFalse);
      expect(restricted.canPublishAnnouncements, isFalse);
      // Convocations et notification restent acquises au coach de l'équipe.
      expect(
        restricted.canManageEventAudience(['a'], allTeams: false),
        isTrue,
      );
    });

    test('événement multi-équipes partiellement coaché', () {
      final allowed = _access(
        coachTeamIds: ['a'],
        coachPermissions: CoachPermissions.defaults.withFlag(
          CoachFlag.canEditMemberRsvp,
          true,
        ),
      );
      // Modifier / annuler / notifier : toutes les équipes requises.
      expect(allowed.canManageEvent(['a', 'b'], allTeams: false), isFalse);
      expect(
        allowed.canManageEventAudience(['a', 'b'], allTeams: false),
        isFalse,
      );
      // RSVP d'autrui : une équipe suffit (pour ses joueurs).
      expect(allowed.canEditMemberRsvp(['a', 'b'], allTeams: false), isTrue);
    });

    test('événement « tout le club » : rien pour un coach', () {
      final allowed = _access(
        coachTeamIds: ['a'],
        coachPermissions: CoachPermissions.defaults.withFlag(
          CoachFlag.canEditMemberRsvp,
          true,
        ),
      );
      expect(allowed.canManageEvent(['a'], allTeams: true), isFalse);
      expect(allowed.canManageEventAudience(['a'], allTeams: true), isFalse);
      expect(allowed.canEditMemberRsvp(['a'], allTeams: true), isFalse);
      expect(allowed.canManageEvent(const [], allTeams: true), isFalse);
    });

    test('RSVP d’autrui et licences : désactivés par défaut', () {
      expect(coach.canEditMemberRsvp(['a'], allTeams: false), isFalse);
      expect(coach.canEditMemberLicense(['a']), isFalse);
      final allowed = _access(
        coachTeamIds: ['a'],
        coachPermissions: CoachPermissions.defaults
            .withFlag(CoachFlag.canEditMemberRsvp, true)
            .withFlag(CoachFlag.canEditMemberLicenses, true),
      );
      expect(allowed.canEditMemberRsvp(['a'], allTeams: false), isTrue);
      expect(allowed.canEditMemberLicense(['a']), isTrue);
      expect(allowed.canEditMemberLicense(['b']), isFalse);
    });
  });

  test('droit planning : tous les événements du club', () {
    final planner = _access(permissions: {ClubPermission.manageEvents});
    expect(planner.canCreateEvents, isTrue);
    expect(planner.canManageEvent(const [], allTeams: true), isTrue);
    expect(planner.canManageEventAudience(['x'], allTeams: true), isTrue);
    expect(planner.canEditMemberRsvp(['x'], allTeams: true), isTrue);
  });

  test('CoachPermissions : défauts, surcharge et sérialisation', () {
    final parsed = CoachPermissions.fromMap({
      'canCreateEvents': false,
      'canViewFees': true,
      'canEditMemberRsvp': 'oui',
    });
    expect(parsed.allows(CoachFlag.canCreateEvents), isFalse);
    expect(parsed.allows(CoachFlag.canInvitePlayers), isTrue);
    expect(parsed.allows(CoachFlag.canEditMemberRsvp), isFalse);
    expect(parsed.toMap().containsKey('canViewFees'), isFalse);
    expect(parsed.toMap().length, CoachFlag.values.length);
    expect(CoachPermissions.fromMap(parsed.toMap()), parsed);
  });
}
