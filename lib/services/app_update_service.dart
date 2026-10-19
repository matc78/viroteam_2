import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Mise à jour obligatoire : lit la version minimale exigée par plateforme
/// dans `app_config/mobile` (renseignée à la main une fois la version
/// publiée sur le store, voir README « Mise à jour obligatoire »).
class AppUpdateService {
  AppUpdateService({FirebaseFirestore? firestore})
    : _db = firestore ?? appFirestore;

  final FirebaseFirestore _db;

  /// Flux de la version minimale exigée pour [platform] (`null` si aucune
  /// exigence : doc absent, champ vide ou plateforme non mobile).
  ///
  /// Ne bloque jamais l'utilisateur sur une panne : une erreur de lecture
  /// (ex. règle `app_config` pas encore déployée) est loggée puis traitée
  /// comme « aucune exigence », et `null` est émis si Firestore n'a rien
  /// répondu après [ProjectConfig.appUpdateCheckTimeout].
  Stream<String?> watchMinimumVersion(TargetPlatform platform) {
    final field = minVersionFieldFor(platform);
    if (field == null) return Stream.value(null);
    final minimumVersions = _db
        .collection(ProjectConfig.appConfigCollection)
        .doc(ProjectConfig.mobileAppConfigDoc)
        .snapshots()
        .map((snapshot) {
          final value = snapshot.data()?[field];
          return value is String && value.trim().isNotEmpty
              ? value.trim()
              : null;
        });
    return failOpen(
      minimumVersions,
      timeout: ProjectConfig.appUpdateCheckTimeout,
    );
  }

  /// Relaie [source] en garantissant une première valeur sous [timeout]
  /// (`null` à défaut) et en remplaçant toute erreur par `null` loggé.
  @visibleForTesting
  static Stream<String?> failOpen(
    Stream<String?> source, {
    required Duration timeout,
  }) {
    late final StreamController<String?> controller;
    StreamSubscription<String?>? subscription;
    Timer? firstValueTimer;

    controller = StreamController<String?>(
      onListen: () {
        firstValueTimer = Timer(timeout, () => controller.add(null));
        subscription = source.listen(
          (minimumVersion) {
            firstValueTimer?.cancel();
            controller.add(minimumVersion);
          },
          onError: (Object error, StackTrace stack) {
            firstValueTimer?.cancel();
            _recordReadFailure(error, stack);
            controller.add(null);
          },
          onDone: controller.close,
        );
      },
      onCancel: () {
        firstValueTimer?.cancel();
        return subscription?.cancel();
      },
    );
    return controller.stream;
  }

  /// Champ Firestore de version minimale pour [platform] (`null` hors mobile).
  static String? minVersionFieldFor(TargetPlatform platform) {
    return switch (platform) {
      TargetPlatform.android => FirestoreFields.minVersionAndroid,
      TargetPlatform.iOS => FirestoreFields.minVersionIos,
      _ => null,
    };
  }

  /// URL du store où télécharger l'app pour [platform].
  static Uri storeUrlFor(TargetPlatform platform) {
    return Uri.parse(
      platform == TargetPlatform.iOS
          ? ProjectConfig.appStoreUrl
          : ProjectConfig.playStoreUrl,
    );
  }

  /// `true` si [currentVersion] est strictement inférieure à [minimumVersion].
  ///
  /// Comparaison numérique segment par segment (`2.10.0` > `2.9.3`), les
  /// segments manquants valent 0. Formes tolérées : `v2.2.7`, `2.2.7+15`
  /// (build ignoré), `2.2.7-hotfix` (suffixe ignoré). Une version minimale
  /// illisible ne bloque jamais l'utilisateur (et est loggée).
  static bool isUpdateRequired({
    required String currentVersion,
    required String? minimumVersion,
  }) {
    if (minimumVersion == null) return false;
    final current = _parseVersion(currentVersion);
    final minimum = _parseVersion(minimumVersion);
    if (minimum == null) {
      debugPrint('app_config : version minimale illisible « $minimumVersion »');
      return false;
    }
    if (current == null) return false;

    final length = current.length > minimum.length
        ? current.length
        : minimum.length;
    for (var index = 0; index < length; index++) {
      final currentPart = index < current.length ? current[index] : 0;
      final minimumPart = index < minimum.length ? minimum[index] : 0;
      if (currentPart != minimumPart) return currentPart < minimumPart;
    }
    return false;
  }

  /// `v2.2.6+15` → `[2, 2, 6]` ; `null` si un segment n'est pas un entier.
  static List<int>? _parseVersion(String version) {
    final core = version
        .trim()
        .replaceFirst(RegExp('^[vV]'), '')
        .split(RegExp('[+-]'))
        .first;
    final numbers = <int>[];
    for (final part in core.split('.')) {
      final number = int.tryParse(part);
      if (number == null || number < 0) return null;
      numbers.add(number);
    }
    return numbers;
  }

  /// Enregistre l'échec de lecture de `app_config` (best-effort).
  static void _recordReadFailure(Object error, StackTrace stack) {
    debugPrint('app_config : lecture impossible ($error)');
    try {
      FirebaseCrashlytics.instance.recordError(
        error,
        stack,
        fatal: false,
        reason: 'app_config read failed',
      );
    } catch (_) {
      // Le monitoring ne doit jamais bloquer l'app.
    }
  }
}
