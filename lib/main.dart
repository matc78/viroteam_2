import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/app/viro_app.dart';
import 'package:viro_team_v2/firebase_options.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/theme_preference_service.dart';
import 'package:viro_team_v2/utils/viro_debug_log.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await _activateAppCheck();

  // Erreurs framework (layout, polices, etc.) : non fatales — évite de
  // gonfler le crash rate Play / Android Vitals. Les vrais crashes isolés
  // restent fatals via [PlatformDispatcher.onError].
  FlutterError.onError = (details) {
    ViroDebugLog.error(
      details.exceptionAsString(),
      details.stack,
    );
    FlutterError.presentError(details);
    FirebaseCrashlytics.instance.recordFlutterError(details);
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    // En debug Crashlytics est off : sans ce dump, l'erreur disparaît
    // (return true = « gérée », plus de fallback console Flutter).
    ViroDebugLog.error(error, stack);
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    return true;
  };
  await FirebaseCrashlytics.instance
      .setCrashlyticsCollectionEnabled(!kDebugMode);

  await initializeDateFormatting('fr_FR');
  // Préférences préchargées : le thème choisi s'applique dès la 1re frame.
  final preferences = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [
        themePreferenceServiceProvider.overrideWithValue(
          ThemePreferenceService(preferences: preferences),
        ),
      ],
      child: const ViroApp(),
    ),
  );
}

/// Active App Check (attestation invisible). Debug/profile = providers debug
/// (enregistrer le token dans la console Firebase) ; release = Play Integrity /
/// App Attest (repli DeviceCheck sur anciens iOS).
Future<void> _activateAppCheck() async {
  final useDebugProviders = !kReleaseMode;
  await FirebaseAppCheck.instance.activate(
    providerAndroid: useDebugProviders
        ? const AndroidDebugProvider()
        : const AndroidPlayIntegrityProvider(),
    providerApple: useDebugProviders
        ? const AppleDebugProvider()
        : const AppleAppAttestWithDeviceCheckFallbackProvider(),
  );
}
