import 'package:cloud_functions/cloud_functions.dart';

/// Codes Cloud Functions considérés comme techniques (pas de message métier).
const _technicalCallableCodes = {
  'unknown',
  'internal',
  'unavailable',
  'deadline-exceeded',
  'resource-exhausted',
};

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
