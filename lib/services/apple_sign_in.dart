import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';

/// Identifiant du provider Apple côté Firebase Auth.
const appleProviderId = 'apple.com';

/// Autorisation Apple transformée en credential Firebase.
///
/// [firstName] / [lastName] / [email] ne sont renvoyés par Apple **qu’à la
/// première autorisation** ; ensuite ils sont `null` et il faut se rabattre
/// sur le `User` Firebase (displayName / email relais).
class AppleAuthResult {
  const AppleAuthResult({
    required this.credential,
    this.firstName,
    this.lastName,
    this.email,
  });

  final OAuthCredential credential;
  final String? firstName;
  final String? lastName;
  final String? email;

  /// Nom complet Apple (vide si Apple ne l’a pas renvoyé).
  String get displayName =>
      [firstName, lastName]
          .map((part) => part?.trim() ?? '')
          .where((part) => part.isNotEmpty)
          .join(' ');
}

/// Sign in with Apple → credential `OAuthProvider('apple.com')` avec nonce
/// SHA-256 (pattern officiel FlutterFire).
class AppleSignInHelper {
  const AppleSignInHelper();

  /// Le bouton Apple n’a de sens que sur les plateformes Apple (guideline 4.8).
  static bool get isSupportedPlatform =>
      !kIsWeb && (Platform.isIOS || Platform.isMacOS);

  /// Nonce aléatoire (alphanumérique + ponctuation autorisée par Apple).
  static String generateNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(
      length,
      (_) => charset[random.nextInt(charset.length)],
    ).join();
  }

  /// Empreinte SHA-256 hexadécimale (le nonce envoyé à Apple).
  static String sha256ofString(String input) =>
      sha256.convert(utf8.encode(input)).toString();

  /// Lance la feuille Apple et renvoie le credential Firebase.
  ///
  /// Lève [AuthCanceledException] si l’utilisateur ferme la feuille.
  Future<AppleAuthResult> authorize() async {
    final rawNonce = generateNonce();
    final hashedNonce = sha256ofString(rawNonce);

    final AuthorizationCredentialAppleID apple;
    try {
      apple = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: hashedNonce,
      );
    } on SignInWithAppleAuthorizationException catch (error) {
      if (error.code == AuthorizationErrorCode.canceled ||
          error.code == AuthorizationErrorCode.unknown) {
        // `unknown` = feuille fermée sans compte iCloud actif : pas une erreur.
        throw const AuthCanceledException();
      }
      rethrow;
    }

    final idToken = apple.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw StateError('Jeton Apple indisponible. Réessaie.');
    }

    final credential = OAuthProvider(appleProviderId).credential(
      idToken: idToken,
      rawNonce: rawNonce,
      accessToken: apple.authorizationCode,
    );

    return AppleAuthResult(
      credential: credential,
      firstName: apple.givenName,
      lastName: apple.familyName,
      email: apple.email,
    );
  }
}
