import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/widgets/notification_permission_banner.dart';

void main() {
  testWidgets('NotificationPermissionBanner déclenche l’autorisation', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NotificationPermissionBanner(onAllow: () => taps++),
        ),
      ),
    );

    expect(
      find.text(AppCopy.notifications.systemDisabledTitle),
      findsOneWidget,
    );
    await tester.tap(find.text(AppCopy.notifications.systemDisabledAction));
    expect(taps, 1);
  });
}
