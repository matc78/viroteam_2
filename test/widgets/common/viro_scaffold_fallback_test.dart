import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Écran qui bascule `fallbackRoute` comme un formulaire avec des
/// modifications en cours (ex. Paramètres du club).
class _DirtyScreen extends StatefulWidget {
  const _DirtyScreen();

  @override
  State<_DirtyScreen> createState() => _DirtyScreenState();
}

class _DirtyScreenState extends State<_DirtyScreen> {
  bool _dirty = false;

  @override
  Widget build(BuildContext context) {
    return ViroScaffold(
      fallbackRoute: _dirty ? null : '/',
      body: ListView(
        children: [
          for (var index = 0; index < 60; index++)
            ListTile(
              title: Text('ligne $index'),
              onTap: () => setState(() => _dirty = !_dirty),
            ),
        ],
      ),
    );
  }
}

void main() {
  testWidgets('basculer fallbackRoute garde la position de défilement',
      (tester) async {
    final router = GoRouter(
      routes: [GoRoute(path: '/', builder: (_, _) => const _DirtyScreen())],
    );
    await tester.pumpWidget(
      MaterialApp.router(theme: ViroTheme.light, routerConfig: router),
    );

    await tester.drag(find.byType(ListView), const Offset(0, -800));
    await tester.pumpAndSettle();
    final offsetBefore =
        tester.state<ScrollableState>(find.byType(Scrollable)).position.pixels;
    expect(offsetBefore, greaterThan(0));

    await tester.tap(find.byType(ListTile).hitTestable().first);
    await tester.pumpAndSettle();
    expect(
      tester.state<_DirtyScreenState>(find.byType(_DirtyScreen))._dirty,
      isTrue,
    );
    expect(
      tester.state<ScrollableState>(find.byType(Scrollable)).position.pixels,
      offsetBefore,
    );
  });
}
