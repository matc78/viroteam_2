import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Garde-fou « droits purs » : seule `members/{uid}.permissions` fait foi,
/// lue via `ClubAccess` (`lib/models/club_access.dart`) et
/// `clubAccessProvider`. Plus de rôle club, ni de comparaison de rôle, ni de
/// rôle porté par la session, ni d'index de clubs autre que
/// `users.memberClubIds`, ni de modèle ou de demande de rôle.
void main() {
  final forbidden = <String, RegExp>{
    'MemberRoles / MemberRoleHierarchy supprimés (utiliser ClubAccess)': RegExp(
      r'\bMemberRoles\b|\bMemberRoleHierarchy\b',
    ),
    'rôle de session supprimé (utiliser clubAccessProvider)': RegExp(
      r'\bactiveRole\b',
    ),
    'TeamManagePermissions supprimé (utiliser ClubAccess)': RegExp(
      r'\bTeamManagePermissions\b',
    ),
    'viewerRole supprimé (lire clubAccessProvider)': RegExp(r'\bviewerRole\b'),
    'ancienne API coach allowsXxx({isAdmin, isCoach}) supprimée': RegExp(
      r'\ballows[A-Z]\w*\(\s*isAdmin',
    ),
    'comparaison d’un rôle de fiche (utiliser ClubAccess)': RegExp(
      r'member\??\.role\b|membership\??\.role\b',
    ),
    'index users.clubMemberships supprimé (lire memberClubIds)': RegExp(
      r'\bclubMemberships\b|\bClubMembershipSummary\b',
    ),
    'modèles de rôle supprimés (droits et fonctions seulement)': RegExp(
      r'\bClubPermissionTemplate\b',
    ),
    'demandes de rôle supprimées': RegExp(
      r'join_requests|\bJoinRequest\w*|roleRequested',
    ),
    // `clubs.adminIds` n'est qu'un index d'audience (destinataires), jamais
    // une autorisation : lire `ClubAccess.isAdmin` / `ClubMember.isAdmin`.
    'adminIds n’autorise rien (utiliser ClubAccess.isAdmin)': RegExp(
      r'adminIds\??\.contains\(|where\(\s*FirestoreFields\.adminIds',
    ),
    // La liste de droits d'une autre fiche se lit via ses getters
    // (`ClubMember.isAdmin`, `permissionCount`) ou `ClubAccess.can`.
    'lecture brute de la liste de droits (utiliser ClubAccess / ClubMember)':
        RegExp(r'\.permissions\.(contains\(|length\b)'),
  };

  test('aucune vérification par rôle dans lib/', () {
    final directory = Directory('lib');
    expect(directory.existsSync(), isTrue, reason: 'lancer depuis la racine');
    final offending = <String>[];

    for (final entity in directory.listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final path = entity.path.replaceAll(r'\', '/');
      final content = entity.readAsStringSync();
      forbidden.forEach((reason, pattern) {
        if (pattern.hasMatch(content)) offending.add('$path ($reason)');
      });
    }

    expect(offending, isEmpty, reason: offending.join('\n'));
  });

  test('le garde-fou détecte les vérifications par rôle', () {
    const samples = [
      'if (member.role == MemberRoles.admin) {}',
      'MemberRoleHierarchy.isCoachOrAbove(role)',
      'ref.watch(sessionProvider).activeRole',
      'viewerRole: viewerRole,',
      'perms.allowsCreateEvents(isAdmin: true, isCoach: false)',
      'club.adminIds.contains(uid)',
      'club?.adminIds?.contains(uid)',
      '.where(FirestoreFields.adminIds, arrayContains: uid)',
      'member.permissions.contains(ClubPermission.admin)',
      'widget.member.permissions.length',
    ];
    for (final sample in samples) {
      expect(
        forbidden.values.any((pattern) => pattern.hasMatch(sample)),
        isTrue,
        reason: sample,
      );
    }
    expect(
      forbidden.values.any(
        (pattern) => pattern.hasMatch('access.can(ClubPermission.manageFees)'),
      ),
      isFalse,
    );
  });

  test('le point d’entrée ClubAccess existe toujours', () {
    final helper = File('lib/models/club_access.dart');
    expect(helper.existsSync(), isTrue);
    expect(helper.readAsStringSync(), contains('class ClubAccess'));
  });
}
