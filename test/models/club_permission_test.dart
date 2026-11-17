import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club_permission.dart';

void main() {
  group('parité avec shared/permissions_catalog.json', () {
    late Map<String, dynamic> shared;

    setUpAll(() {
      final file = File('shared/permissions_catalog.json');
      expect(file.existsSync(), isTrue, reason: 'lancer depuis la racine');
      shared = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    });

    test('droits', () {
      expect([
        for (final permission in ClubPermission.values) permission.id,
      ], shared['permissions']);
      expect(ClubPermission.admin.id, shared['adminPermission']);
    });

    test('droits impliqués', () {
      final implies = {
        for (final permission in ClubPermission.values)
          if (permission.implied.isNotEmpty)
            permission.id: [
              for (final implied in permission.implied) implied.id,
            ],
      };
      expect(implies, shared['implies']);
    });

    test('fonctions', () {
      final functions = {
        for (final function in ClubFunction.values)
          function.id: [
            for (final permission in function.permissions) permission.id,
          ],
      };
      expect(functions, shared['functions']);
    });

    test('plus de modèles de rôle', () {
      expect(shared.containsKey('templates'), isFalse);
    });

    test('flags coach', () {
      final flags = {
        for (final flag in CoachFlag.values) flag.id: flag.defaultValue,
      };
      expect(flags, shared['coachFlags']);
    });
  });

  group('ClubPermission', () {
    test('parse ignore les identifiants inconnus', () {
      expect(ClubPermission.parse(['viewFees', 'owner', 3]), {
        ClubPermission.viewFees,
      });
      expect(ClubPermission.parse(null), isEmpty);
    });

    test('normalize trie et ajoute les droits impliqués', () {
      expect(
        ClubPermission.normalize({
          ClubPermission.viewActivity,
          ClubPermission.manageFees,
        }),
        [
          ClubPermission.manageFees,
          ClubPermission.viewFees,
          ClubPermission.viewActivity,
        ],
      );
    });

    test('normalize réduit la liste à admin', () {
      expect(
        ClubPermission.normalize({
          ClubPermission.manageFees,
          ClubPermission.admin,
        }),
        [ClubPermission.admin],
      );
    });
  });

  group('ClubFunction', () {
    test('cochée, partielle ou absente', () {
      const function = ClubFunction.membersManager;
      expect(
        function.isFullyGranted({
          ClubPermission.manageMembers,
          ClubPermission.manageTeams,
        }),
        isTrue,
      );
      expect(function.isPartiallyGranted({ClubPermission.manageTeams}), isTrue);
      expect(function.isFullyGranted({ClubPermission.manageTeams}), isFalse);
      expect(function.isPartiallyGranted({ClubPermission.viewFees}), isFalse);
      expect(function.isFullyGranted({ClubPermission.admin}), isTrue);
    });

  });

  group('derivedMemberBadges', () {
    test('admin, coach et joueur cumulés', () {
      expect(
        derivedMemberBadges(
          permissions: {ClubPermission.admin},
          coachTeamIds: ['a'],
          teamIds: ['a', 'b'],
        ),
        [MemberBadge.admin, MemberBadge.coach, MemberBadge.player],
      );
    });

    test('coach seul : son équipe ne compte pas comme effectif joueur', () {
      expect(
        derivedMemberBadges(
          permissions: {},
          coachTeamIds: ['a'],
          teamIds: ['a'],
        ),
        [MemberBadge.coach],
      );
    });

    test('badge Membre sans équipe ni droit admin', () {
      expect(
        derivedMemberBadges(
          permissions: {ClubPermission.manageFees},
          coachTeamIds: [],
          teamIds: [],
        ),
        [MemberBadge.member],
      );
    });

    test('identifiants partagés avec les Functions et le portail', () {
      expect(
        [for (final badge in MemberBadge.values) ChatBadgeIds.of(badge)],
        ['admin', 'coach', 'player', 'member'],
      );
      expect(ChatBadgeIds.of(MemberBadge.member), ChatBadgeIds.member);
    });
  });
}
