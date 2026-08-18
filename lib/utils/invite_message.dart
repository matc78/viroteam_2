import 'dart:math';

import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';

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
  return '''Rejoins ${club.name} sur ViroTeam !
Ton code : ${invitation.code}
Valable 7 jours.
Ouvre l'app → « J'ai un code d'invitation » et saisis ce code.''';
}

/// Message FR pour une invitation parent (pas un rôle club).
String buildGuardianInviteMessage({
  required Club club,
  required String code,
  required String childFirstName,
}) {
  final name =
      childFirstName.trim().isEmpty ? 'ton enfant' : childFirstName.trim();
  return '''Tu pourras voir le planning de $name, répondre aux convocations et payer la cotisation.
Club : ${club.name}
Code : $code
Ouvre l'app → « J'ai un code d'invitation » et saisis ce code.''';
}
