import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/widgets/common/portal_handoff_sheet.dart';

void main() {
  test('portalMembersImportUrl garde le club et ouvre l’import', () {
    final url = portalMembersImportUrl(clubId: 'club1');
    expect(url.path, '/members');
    expect(url.queryParameters, {'clubId': 'club1', 'import': '1'});
  });

  testWidgets('copie le lien et ferme la feuille', (tester) async {
    final url = Uri.parse('https://www.viroteam.com/members?import=1');
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          copied = (call.arguments as Map)['text'] as String?;
        }
        return null;
      },
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showPortalHandoffSheet(
                context,
                title: 'Importer depuis un ordi',
                message: 'Explication',
                url: url,
              ),
              child: const Text('ouvrir'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();

    expect(find.text('Importer depuis un ordi'), findsOneWidget);
    expect(find.text(url.toString()), findsOneWidget);
    expect(find.text(AppCopy.common.portalHandoffOpen), findsOneWidget);

    await tester.tap(find.text(AppCopy.common.portalHandoffCopy));
    await tester.pumpAndSettle();

    expect(copied, url.toString());
    expect(find.text('Importer depuis un ordi'), findsNothing);
    expect(find.text(AppCopy.common.portalHandoffCopied), findsOneWidget);
  });
}
