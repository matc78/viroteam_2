import 'package:cloud_functions/cloud_functions.dart';

/// Codes Cloud Functions considérés comme techniques (pas de message métier).
const _technicalCallableCodes = {
  'unknown',
  'internal',
  'unavailable',
  'deadline-exceeded',
  'resource-exhausted',
};

/// `details.reason` des Functions quand l'e-mail du compte n'est pas confirmé
/// (`EMAIL_NOT_VERIFIED_REASON`, functions/src/common.ts).
const emailNotVerifiedReason = 'email_not_verified';

/// Vrai si la callable a refusé l'action faute d'e-mail confirmé.
bool isEmailNotVerifiedError(Object error) {
  if (error is! FirebaseFunctionsException) return false;
  if (error.code != 'failed-precondition') return false;
  final details = error.details;
  return details is Map && details['reason'] == emailNotVerifiedReason;
}

/// Message utilisateur depuis une erreur Cloud Functions (ou fallback).
///
/// Les codes techniques et les erreurs non-[FirebaseFunctionsException]
/// renvoient toujours [fallback] (pas de stack / message Java brut).
String callableErrorMessage(
  Object error, {
  String fallback = 'Action impossible',
}) {
  if (error is FirebaseFunctionsException) {
    if (_technicalCallableCodes.contains(error.code)) return fallback;
    final message = error.message?.trim();
    if (message != null && message.isNotEmpty) return message;
  }
  return fallback;
}
