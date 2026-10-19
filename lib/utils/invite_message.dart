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
  return AppCopy.join.clubInviteMessage(
    clubName: club.name,
    code: invitation.code,
    joinUrl: joinUrl,
    appStoreUrl: ProjectConfig.appStoreUrl,
    playStoreUrl: ProjectConfig.playStoreUrl,
    siteUrl: ProjectConfig.siteUrl,
  );
}

/// Message FR pour un code d’équipe multi-usage (WhatsApp / SMS).
///
/// [joinUrl] : URL renvoyée par la callable si dispo, sinon reconstruite.
String buildTeamInviteMessage({
  required Club club,
  required String teamName,
  required String code,
  String? joinUrl,
}) {
  final resolvedJoinUrl = (joinUrl != null && joinUrl.trim().isNotEmpty)
      ? joinUrl.trim()
      : inviteJoinUrl(code).toString();
  return AppCopy.join.teamInviteShareMessage(
    clubName: club.name,
    teamName: teamName,
    code: code,
    joinUrl: resolvedJoinUrl,
    appStoreUrl: ProjectConfig.appStoreUrl,
    playStoreUrl: ProjectConfig.playStoreUrl,
    siteUrl: ProjectConfig.siteUrl,
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
  final joinUrl = inviteJoinUrl(code).toString();
  return AppCopy.join.guardianInviteShareMessage(
    childFirstName: name,
    clubName: club.name,
    code: code,
    joinUrl: joinUrl,
    appStoreUrl: ProjectConfig.appStoreUrl,
    playStoreUrl: ProjectConfig.playStoreUrl,
    siteUrl: ProjectConfig.siteUrl,
  );
}
