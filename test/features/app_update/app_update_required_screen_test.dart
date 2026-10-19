import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/app_update/screens/app_update_required_screen.dart';

void main() {
  testWidgets('AppUpdateRequiredScreen affiche le titre, le bouton et la version',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const AppUpdateRequiredScreen(),
      ),
    );

    expect(find.text(AppCopy.appUpdate.title), findsOneWidget);
    expect(find.text(AppCopy.appUpdate.updateAction), findsOneWidget);
    expect(
      find.text(AppCopy.appUpdate.currentVersion(ProjectConfig.appVersionName)),
      findsOneWidget,
    );
  });
}
