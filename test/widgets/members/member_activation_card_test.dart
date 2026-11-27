import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_activation_card.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/services/member/member_activation.dart';

Widget _host(Widget child) => MaterialApp(
  theme: ViroTheme.light,
  home: Scaffold(
    body: Padding(padding: const EdgeInsets.all(16), child: child),
  ),
);

void main() {
  final stats = MemberActivationStats.of(const [
    ClubMember(memberId: '1', status: 'active', hasLinkedAccount: true),
    ClubMember(memberId: '2', status: 'active', email: 'x@x.fr'),
    ClubMember(memberId: '3', status: 'active'),
  ]);

  testWidgets('affiche le résumé et filtre puis défiltre au re-tap', (
    tester,
  ) async {
    MemberActivationBucket? selected;
    await tester.pumpWidget(
      _host(
        StatefulBuilder(
          builder: (context, setState) => MemberActivationCard(
            stats: stats,
            selected: selected,
            onSelected: (bucket) => setState(() => selected = bucket),
          ),
        ),
      ),
    );

    expect(
      find.text(AppCopy.members.activationSummary(1, 3, 33)),
      findsOneWidget,
    );
    expect(find.text(AppCopy.members.activationHint), findsOneWidget);

    await tester.tap(find.text(AppCopy.members.activationToInvite));
    await tester.pumpAndSettle();
    expect(selected, MemberActivationBucket.toInvite);
    expect(find.text(AppCopy.members.activationToInviteHint), findsOneWidget);

    await tester.tap(find.text(AppCopy.members.activationToInvite));
    await tester.pumpAndSettle();
    expect(selected, isNull);
  });

  testWidgets('effectif complet : message de réussite, pas d’étapes', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        MemberActivationCard(
          stats: MemberActivationStats.of(const [
            ClubMember(memberId: '1', status: 'active', hasLinkedAccount: true),
          ]),
          selected: null,
          onSelected: (_) {},
        ),
      ),
    );
    expect(find.text(AppCopy.members.activationAllLinked), findsOneWidget);
    expect(find.text(AppCopy.members.activationToInvite), findsNothing);
  });
}
