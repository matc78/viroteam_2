import 'package:flutter/material.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/services/member_invite_service.dart';
import 'package:viro_team_v2/widgets/common/viro_status_toast.dart';

/// Construit le message récapitulatif d’un envoi d’invitations.
String buildInviteSendSummary(SendMemberInvitesResult result) {
  final summary = StringBuffer(
    '${result.sent} invitation${result.sent > 1 ? 's' : ''} '
    'envoyée${result.sent > 1 ? 's' : ''}',
  );
  if (result.skipped > 0) {
    summary.write(
      ', ${result.skipped} ignorée${result.skipped > 1 ? 's' : ''}',
    );
  }
  if (result.failed > 0) {
    summary.write(
      ', ${result.failed} erreur${result.failed > 1 ? 's' : ''}',
    );
  }
  summary.write('.');

  final reasonCounts = <String, int>{};
  for (final item in result.results) {
    if (item.status == 'sent') continue;
    final reason = (item.reason ?? 'Motif inconnu').trim();
    if (reason.isEmpty) continue;
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  if (reasonCounts.isNotEmpty) {
    final reasons = reasonCounts.entries
        .map((entry) => '${entry.key} (${entry.value})')
        .join(' · ');
    summary.write(' Motifs : $reasons');
  }
  return summary.toString();
}

/// Affiche un unique toast de récap (check vert / erreur).
void showInviteSendFeedback(
  BuildContext context, {
  required SendMemberInvitesResult result,
  List<ClubMember> members = const [],
}) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).clearSnackBars();

  final success = result.sent > 0;
  ViroStatusToast.show(
    context,
    message: buildInviteSendSummary(result),
    success: success,
    duration: const Duration(seconds: 4),
  );
}
