import 'dart:math';

import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/utils/portal_links.dart';

/// Génère un code d'invitation alphanumérique (6 caractères, uppercase).
String generateInviteCode({int length = 6}) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  final random = Random.secure();
  return List.generate(length, (_) => chars[random.nextInt(chars.length)])
      .join();
}

/// Message FR prêt à copier pour WhatsApp / SMS.
String buildInviteMessage({
  required Club club,
  required ClubInvitation invitation,
}) {
  final joinUrl = inviteJoinUrl(invitation.code).toString();
  const storeLine = '\nApp Android : ${ProjectConfig.playStoreUrl}';
  return AppCopy.join.clubInviteMessage(
    clubName: club.name,
    code: invitation.code,
    joinUrl: joinUrl,
    storeLine: storeLine,
  );
}

/// Message FR pour une invitation parent (pas un rôle club).
String buildGuardianInviteMessage({
  required Club club,
  required String code,
  required String childFirstName,
}) {
  final name =
      childFirstName.trim().isEmpty
          ? AppCopy.join.defaultChildName
          : childFirstName.trim();
  return AppCopy.join.guardianInviteShareMessage(
    childFirstName: name,
    clubName: club.name,
    code: code,
  );
}
