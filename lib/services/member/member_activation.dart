import 'package:viro_team_v2/models/club_member.dart';

/// Étape d’activation du compte d’un membre (aligné portail
/// `ActivationBucket`, `portal/src/lib/members/membersView.ts`).
///
/// Les quatre étapes sont disjointes : leur somme = nombre de fiches.
enum MemberActivationBucket {
  /// Non inscrit, avec e-mail, sans invitation valide : prêt pour un envoi.
  toInvite,

  /// Non inscrit avec un code d’invitation encore valide : à relancer.
  pendingInvite,

  /// Non inscrit et sans e-mail : ajouter une adresse pour l’inviter.
  noEmail,

  /// Compte ViroTeam lié à la fiche.
  linked,
}

/// Étape d’activation de [member].
MemberActivationBucket memberActivationBucket(ClubMember member) {
  // Lié = `accountUid` posé, comme le portail et les Functions (le profil
  // `users/{uid}` peut être illisible ou absent).
  if (member.accountUid != null || member.hasLinkedAccount) {
    return MemberActivationBucket.linked;
  }
  if (member.email?.trim().isEmpty ?? true) {
    return MemberActivationBucket.noEmail;
  }
  if (member.hasPendingInvite) return MemberActivationBucket.pendingInvite;
  return MemberActivationBucket.toInvite;
}

/// Compteurs d’activation d’un effectif.
class MemberActivationStats {
  const MemberActivationStats({required this.counts, required this.total});

  /// Calcule les compteurs de [members].
  factory MemberActivationStats.of(Iterable<ClubMember> members) {
    final counts = {
      for (final bucket in MemberActivationBucket.values) bucket: 0,
    };
    var total = 0;
    for (final member in members) {
      final bucket = memberActivationBucket(member);
      counts[bucket] = counts[bucket]! + 1;
      total++;
    }
    return MemberActivationStats(counts: counts, total: total);
  }

  /// Nombre de fiches par étape (toutes les étapes présentes).
  final Map<MemberActivationBucket, int> counts;

  /// Nombre total de fiches.
  final int total;

  /// Nombre de fiches à l’étape [bucket].
  int count(MemberActivationBucket bucket) => counts[bucket] ?? 0;

  /// Comptes liés.
  int get linked => count(MemberActivationBucket.linked);

  /// Part des comptes liés, arrondie (0 si effectif vide).
  int get linkedPercent => total == 0 ? 0 : (linked * 100 / total).round();

  /// Vrai quand tout l’effectif a un compte (rien à faire).
  bool get allLinked => total > 0 && linked == total;
}
