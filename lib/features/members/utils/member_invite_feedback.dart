import 'package:flutter/material.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/services/member_invite_service.dart';
import 'package:viro_team_v2/widgets/common/viro_status_toast.dart';

/// Construit le message récapitulatif d’un envoi d’invitations.
String buildInviteSendSummary(SendMemberInvitesResult result) {
  final reasonCounts = <String, int>{};
  for (final item in result.results) {
    if (item.status == 'sent') continue;
    final reason =
        (item.reason ?? AppCopy.members.unknownReason).trim();
    if (reason.isEmpty) continue;
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  String? reasonsSuffix;
  if (reasonCounts.isNotEmpty) {
    reasonsSuffix = reasonCounts.entries
        .map((entry) => '${entry.key} (${entry.value})')
        .join(' · ');
  }
  return AppCopy.members.inviteSendSummary(
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    reasonsSuffix: reasonsSuffix,
  );
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
