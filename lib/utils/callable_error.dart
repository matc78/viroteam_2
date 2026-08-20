import 'package:cloud_functions/cloud_functions.dart';

/// Message utilisateur depuis une erreur Cloud Functions (ou fallback).
String callableErrorMessage(Object error, {String fallback = 'Action impossible'}) {
  if (error is FirebaseFunctionsException) {
    final message = error.message?.trim();
    if (message != null && message.isNotEmpty) return message;
  }
  return error.toString().trim().isNotEmpty ? error.toString() : fallback;
}
