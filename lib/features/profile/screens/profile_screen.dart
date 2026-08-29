import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';

/// Redirige vers [UserSettingsScreen] (rétrocompat `/profile`).
@Deprecated('Utiliser UserSettingsScreen via AppRoutes.userSettings')
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (context.mounted) context.go(AppRoutes.userSettings);
    });
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
