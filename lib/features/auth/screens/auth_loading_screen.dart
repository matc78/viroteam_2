import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Écran d'attente pendant la résolution de session (Auth + profil Firestore).
class AuthLoadingScreen extends StatelessWidget {
  const AuthLoadingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ViroScaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ViroLogo(height: 128),
            SizedBox(height: ViroSpacing.xl),
            ViroLogoLoader(size: 36),
          ],
        ),
      ),
    );
  }
}
