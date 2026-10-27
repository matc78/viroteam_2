import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';

/// État de la cotisation résumé pour la carte de raccourci.
enum ClubFeeSummaryKind { upToDate, due }

/// Cotisation de la saison active, réduite à ce que la fiche club affiche.
class ClubFeeSummary {
  const ClubFeeSummary({required this.kind, this.remainingCents = 0});

  final ClubFeeSummaryKind kind;
  final int remainingCents;
}

/// Infos affichées sur les cartes de raccourci de la fiche club.
///
/// Un champ `null` signifie « pas encore chargé » ou « sans objet » : la
/// carte affiche alors un libellé neutre.
class ClubShortcutsSummary {
  const ClubShortcutsSummary({
    this.weekEventCount,
    this.teamNames,
    this.fee,
  });

  final int? weekEventCount;
  final List<String>? teamNames;
  final ClubFeeSummary? fee;
}

/// Nombre d'événements non annulés dans les 7 prochains jours (aujourd'hui
/// inclus), à partir de [now].
int countEventsThisWeek(List<ClubEvent> upcoming, DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  final end = today.add(const Duration(days: 7));
  return upcoming
      .where((event) => !event.canceled)
      .where((event) => !event.date.isBefore(today) && event.date.isBefore(end))
      .length;
}

/// Résume [fee] pour [season] : à jour (payé, exonéré ou rien à régler) ou
/// montant restant dû.
ClubFeeSummary summarizeFee(MemberFee fee, FeeSeason season) {
  if (fee.status == MemberFeeStatus.paye ||
      fee.status == MemberFeeStatus.exonere) {
    return const ClubFeeSummary(kind: ClubFeeSummaryKind.upToDate);
  }
  final remaining = fee.remainingCents(season);
  if (remaining <= 0) {
    return const ClubFeeSummary(kind: ClubFeeSummaryKind.upToDate);
  }
  return ClubFeeSummary(
    kind: ClubFeeSummaryKind.due,
    remainingCents: remaining,
  );
}

/// Synthèse pour les raccourcis de la fiche club (vue membre, pas famille).
final clubShortcutsSummaryProvider =
    Provider.family<ClubShortcutsSummary, String>((ref, clubId) {
  final events = ref.watch(clubEventsProvider(clubId)).value;
  final teams = ref.watch(myTeamsProvider(clubId)).value;
  final member = ref.watch(clubMemberProvider(clubId)).value;

  ClubFeeSummary? fee;
  if (member != null) {
    final feeData = ref
        .watch(myFeeProvider((clubId: clubId, memberId: member.memberId)))
        .value;
    final season = feeData?.season;
    final memberFee = feeData?.fee;
    if (season != null && memberFee != null) {
      fee = summarizeFee(memberFee, season);
    }
  }

  return ClubShortcutsSummary(
    weekEventCount:
        events != null ? countEventsThisWeek(events.upcoming, DateTime.now()) : null,
    teamNames: teams?.map((team) => team.name).toList(),
    fee: fee,
  );
});
