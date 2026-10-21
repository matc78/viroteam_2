import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Écran ouvert par deep link : seul dans la pile, il doit pouvoir remonter
/// vers son parent logique (bouton retour et retour système).
GoRouter _router({required String initialLocation}) {
  return GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: '/club',
        builder: (_, _) => const ViroScaffold(body: Text('club')),
      ),
      GoRoute(
        path: '/planning',
        builder: (_, _) => const ViroScaffold(
          fallbackRoute: '/club',
          appBar: ViroAppBar(fallbackRoute: '/club'),
          body: Text('planning'),
        ),
      ),
    ],
  );
}

void main() {
  testWidgets('pile vide : le chevron retour va sur la route parente',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp.router(routerConfig: _router(initialLocation: '/planning')),
    );
    expect(find.text('planning'), findsOneWidget);

    await tester.tap(find.byTooltip(AppCopy.common.back));
    await tester.pumpAndSettle();

    expect(find.text('club'), findsOneWidget);
  });

  testWidgets('pile vide : le retour système va sur la route parente',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp.router(routerConfig: _router(initialLocation: '/planning')),
    );

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text('club'), findsOneWidget);
  });

  testWidgets('pile non vide : le chevron dépile', (tester) async {
    final router = _router(initialLocation: '/club');
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    router.push('/planning');
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip(AppCopy.common.back));
    await tester.pumpAndSettle();

    expect(find.text('club'), findsOneWidget);
    expect(router.canPop(), isFalse);
  });
}
