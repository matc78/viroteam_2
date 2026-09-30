import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/deep_links.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

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
      final router = ref.read(goRouterProvider);
      bindAppDeepLinks(ref: ref, router: router);
      final push = ref.read(pushNotificationServiceProvider);
      push.bindDeepLinkHandler(
        (uri) => handleDeepLinkUri(ref: ref, router: router, uri: uri),
      );
      push.start();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(goRouterProvider);
    final feeDeadlineUrgent = ref.watch(feeDeadlineUrgentBackgroundProvider);

    ref.listen(authStateProvider, (previous, next) {
      final user = next.value;
      final previousUid = previous?.value?.uid;
      if (user != null && user.uid != previousUid) {
        ref.read(pushNotificationServiceProvider).syncTokenAfterAuth();
      }
    });

    // Lien / push reçu à froid : la session club est posée dès que le profil
    // arrive, avant que le routeur ne consomme la destination en attente.
    ref.listen(viroUserProvider, (previous, next) {
      final user = next.value;
      if (user == null) return;
      prepareSessionForPendingDeepLink(ref: ref, user: user);
    });

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
      builder: (context, child) {
        return FeeDeadlineBackground(
          active: feeDeadlineUrgent,
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
