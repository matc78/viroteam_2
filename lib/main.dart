import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:viro_team_v2/app/viro_app.dart';
import 'package:viro_team_v2/firebase_options.dart';
import 'package:viro_team_v2/utils/viro_debug_log.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

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
  runApp(const ProviderScope(child: ViroApp()));
}
