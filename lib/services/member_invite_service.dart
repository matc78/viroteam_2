import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';

/// Résultat d’un envoi d’invitation membre via Brevo.
class SendMemberInvitesResult {
  const SendMemberInvitesResult({
    required this.sent,
    required this.skipped,
    required this.failed,
    required this.results,
  });

  final int sent;
  final int skipped;
  final int failed;
  final List<SendMemberInviteItemResult> results;

  factory SendMemberInvitesResult.fromMap(Map<String, dynamic> data) {
    final rawResults = data['results'];
    final items = rawResults is List
        ? rawResults
            .whereType<Map>()
            .map(
              (item) => SendMemberInviteItemResult.fromMap(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList()
        : <SendMemberInviteItemResult>[];

    return SendMemberInvitesResult(
      sent: (data['sent'] as num?)?.toInt() ?? 0,
      skipped: (data['skipped'] as num?)?.toInt() ?? 0,
      failed: (data['failed'] as num?)?.toInt() ?? 0,
      results: items,
    );
  }
}

/// Détail par membre pour un envoi d’invitation.
class SendMemberInviteItemResult {
  const SendMemberInviteItemResult({
    required this.memberId,
    required this.status,
    this.reason,
    this.messageId,
  });

  final String memberId;
  final String status;
  final String? reason;
  final String? messageId;

  factory SendMemberInviteItemResult.fromMap(Map<String, dynamic> data) {
    return SendMemberInviteItemResult(
      memberId: data['memberId'] as String? ?? '',
      status: data['status'] as String? ?? 'failed',
      reason: data['reason'] as String?,
      messageId: data['messageId'] as String?,
    );
  }
}

/// Envoi des e-mails d’invitation membre via Brevo (admin club).
class MemberInviteService {
  MemberInviteService({FirebaseFunctions? functions})
      : _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFunctions _functions;

  /// Envoie les invitations par e-mail pour les membres donnés.
  ///
  /// Retourne le résultat agrégé ; lève une [Exception] si aucun envoi réussi
  /// et qu’une raison est disponible.
  Future<SendMemberInvitesResult> sendMemberInvites({
    required String clubId,
    required List<String> memberIds,
  }) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('sendMemberInvites'));
    final response = await callable.call<Map<String, dynamic>>({
      'clubId': clubId,
      'memberIds': memberIds,
    });
    return SendMemberInvitesResult.fromMap(response.data);
  }
}
