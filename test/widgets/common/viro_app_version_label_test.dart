import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_app_version_label.dart';

void main() {
  testWidgets('affiche ViroTeam + version installée', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const Scaffold(
          body: Center(child: ViroAppVersionLabel()),
        ),
      ),
    );

    expect(
      find.text(
        AppCopy.common.appVersionLabel(ProjectConfig.appVersionName),
      ),
      findsOneWidget,
    );
  });
}
