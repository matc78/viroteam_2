import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/home/widgets/notification_soft_ask_sheet.dart';

void main() {
  testWidgets('NotificationSoftAskSheet : bénéfices et deux choix', (
    tester,
  ) async {
    var enabled = 0;
    var later = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NotificationSoftAskSheet(
            onEnable: () => enabled++,
            onLater: () => later++,
          ),
        ),
      ),
    );

    expect(find.text(AppCopy.notifications.softAskTitle), findsOneWidget);
    expect(
      find.text(AppCopy.notifications.softAskBenefitAnnouncements),
      findsOneWidget,
    );

    await tester.tap(find.text(AppCopy.notifications.softAskEnable));
    await tester.tap(find.text(AppCopy.notifications.softAskLater));
    expect(enabled, 1);
    expect(later, 1);
  });
}
