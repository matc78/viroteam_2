import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/deep_links.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_theme.dart';

class ViroApp extends ConsumerStatefulWidget {
  const ViroApp({super.key});

  @override
  ConsumerState<ViroApp> createState() => _ViroAppState();
}

class _ViroAppState extends ConsumerState<ViroApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      bindAppDeepLinks(
        ref: ref,
        router: ref.read(goRouterProvider),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(goRouterProvider);

    return MaterialApp.router(
      title: 'ViroTeam',
      debugShowCheckedModeBanner: false,
      theme: ViroTheme.light,
      locale: const Locale('fr', 'FR'),
      supportedLocales: const [Locale('fr', 'FR')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
    );
  }
}
