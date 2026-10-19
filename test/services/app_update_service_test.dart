import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/services/app_update_service.dart';

void main() {
  group('AppUpdateService.isUpdateRequired', () {
    bool required(String current, String? minimum) =>
        AppUpdateService.isUpdateRequired(
          currentVersion: current,
          minimumVersion: minimum,
        );

    test('pas de version minimale → jamais bloqué', () {
      expect(required('2.2.6', null), isFalse);
    });

    test('version égale ou supérieure → pas bloqué', () {
      expect(required('2.2.6', '2.2.6'), isFalse);
      expect(required('2.3.0', '2.2.6'), isFalse);
      expect(required('3.0.0', '2.9.9'), isFalse);
    });

    test('version inférieure → bloqué', () {
      expect(required('2.2.6', '2.2.7'), isTrue);
      expect(required('2.2.6', '2.3.0'), isTrue);
      expect(required('1.9.9', '2.0.0'), isTrue);
    });

    test('comparaison numérique, pas alphabétique', () {
      expect(required('2.9.0', '2.10.0'), isTrue);
      expect(required('2.10.0', '2.9.0'), isFalse);
    });

    test('segments manquants valent 0', () {
      expect(required('2.2', '2.2.0'), isFalse);
      expect(required('2.2', '2.2.1'), isTrue);
    });

    test('formes courantes saisies en console tolérées', () {
      expect(required('2.2.6', 'v2.2.7'), isTrue);
      expect(required('2.2.6', 'V2.2.7'), isTrue);
      expect(required('2.2.6', '2.2.7+15'), isTrue);
      expect(required('2.2.6', '2.2.7-hotfix'), isTrue);
      expect(required('2.2.6', '2.2.7 '), isTrue);
      expect(required('2.2.7', '2.2.7+15'), isFalse);
    });

    test('version minimale illisible → jamais bloqué', () {
      expect(required('2.2.6', 'abc'), isFalse);
      expect(required('2.2.6', '2.x.0'), isFalse);
      expect(required('2.2.6', ''), isFalse);
    });
  });

  group('AppUpdateService.failOpen', () {
    test('relaie les versions minimales reçues', () async {
      final source = Stream<String?>.fromIterable(['2.2.7', null]);
      final values = await AppUpdateService.failOpen(
        source,
        timeout: const Duration(seconds: 5),
      ).toList();
      expect(values, ['2.2.7', null]);
    });

    test('une erreur de lecture devient « aucune exigence »', () async {
      final source = Stream<String?>.error(Exception('permission-denied'));
      final values = await AppUpdateService.failOpen(
        source,
        timeout: const Duration(seconds: 5),
      ).toList();
      expect(values, [null]);
    });

    test('sans réponse avant le délai → null, puis la vraie valeur', () async {
      final source = StreamController<String?>();
      final values = <String?>[];
      final subscription = AppUpdateService.failOpen(
        source.stream,
        timeout: const Duration(milliseconds: 10),
      ).listen(values.add);

      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(values, [null]);

      source.add('2.2.7');
      await Future<void>.delayed(Duration.zero);
      expect(values, [null, '2.2.7']);

      await subscription.cancel();
      await source.close();
    });
  });

  group('AppUpdateService par plateforme', () {
    test('champ de version minimale Android / iOS, rien ailleurs', () {
      expect(
        AppUpdateService.minVersionFieldFor(TargetPlatform.android),
        FirestoreFields.minVersionAndroid,
      );
      expect(
        AppUpdateService.minVersionFieldFor(TargetPlatform.iOS),
        FirestoreFields.minVersionIos,
      );
      expect(AppUpdateService.minVersionFieldFor(TargetPlatform.macOS), isNull);
    });

    test('URL du store selon la plateforme', () {
      expect(
        AppUpdateService.storeUrlFor(TargetPlatform.iOS).toString(),
        ProjectConfig.appStoreUrl,
      );
      expect(
        AppUpdateService.storeUrlFor(TargetPlatform.android).toString(),
        ProjectConfig.playStoreUrl,
      );
    });
  });
}
