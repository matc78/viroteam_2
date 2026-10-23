import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/settings/providers/analytics_consent_provider.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/providers/session_provider.dart';
import 'package:viro_team_v2/services/analytics_consent_service.dart';
import 'package:viro_team_v2/services/analytics_identity.dart';

/// Aligne l'identité PostHog sur la session : identifie l'utilisateur (uid
/// Firebase) et son club actif quand le consentement est donné, oublie tout à
/// la déconnexion. Les envois ne partent que si quelque chose a changé.
/// À garder vivant depuis la racine de l'app (`ref.watch`).
final analyticsIdentitySyncProvider = Provider<void>((ref) {
  final analytics = ref.read(analyticsServiceProvider);
  String? signedInUid;
  String? sentPerson;
  String? sentClub;

  void sync() {
    final authUser = ref.read(authStateProvider).value;
    if (authUser == null) {
      if (signedInUid != null) unawaited(analytics.resetIdentity());
      signedInUid = null;
      sentPerson = null;
      sentClub = null;
      return;
    }
    signedInUid = authUser.uid;

    if (ref.read(analyticsConsentProvider) != AnalyticsConsent.granted) {
      // Renvoyé tel quel si l'utilisateur accepte plus tard.
      sentPerson = null;
      sentClub = null;
      return;
    }

    final user = ref.read(viroUserProvider).value;
    if (user != null && user.uid == authUser.uid) {
      final properties = analyticsPersonProperties(user);
      final signature = '${user.uid}|$properties';
      if (signature != sentPerson) {
        sentPerson = signature;
        final createdAt = authUser.metadata.creationTime;
        unawaited(
          analytics.identifyUser(
            userId: user.uid,
            properties: properties,
            propertiesSetOnce: createdAt == null
                ? null
                : {'signup_at': createdAt.toUtc().toIso8601String()},
          ),
        );
      }
    }

    final clubId = ref.read(sessionProvider).activeClubId;
    if (clubId == null || clubId.isEmpty) return;
    final club = (ref.read(userClubsProvider).value ?? const [])
        .where((entry) => entry.club.id == clubId)
        .firstOrNull
        ?.club;
    final properties =
        club == null ? const <String, Object>{} : analyticsClubProperties(club);
    final signature = '$clubId|$properties';
    if (signature != sentClub) {
      sentClub = signature;
      unawaited(
        analytics.setActiveClub(clubId: clubId, properties: properties),
      );
    }
  }

  ref.listen(authStateProvider, (previous, next) => sync());
  ref.listen(analyticsConsentProvider, (previous, next) => sync());
  ref.listen(viroUserProvider, (previous, next) => sync());
  ref.listen(sessionProvider, (previous, next) => sync());
  ref.listen(userClubsProvider, (previous, next) => sync());
  sync();
});
