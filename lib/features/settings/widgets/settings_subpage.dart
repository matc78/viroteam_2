import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Gabarit d'une sous-page des paramètres : AppBar avec retour vers le hub
/// et contenu défilant.
///
/// [children] pour un contenu statique ; [userBuilder] quand le contenu
/// dépend du profil (chargement / erreur gérés ici).
class SettingsSubpage extends ConsumerWidget {
  const SettingsSubpage({
    super.key,
    required this.title,
    this.children,
    this.userBuilder,
    this.fallbackRoute = AppRoutes.userSettings,
  }) : assert((children == null) != (userBuilder == null));

  final String title;
  final List<Widget>? children;
  final List<Widget> Function(BuildContext context, ViroUser user)? userBuilder;
  final String fallbackRoute;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ViroScaffold(
      fallbackRoute: fallbackRoute,
      appBar: ViroAppBar(
        fallbackRoute: fallbackRoute,
        title: Text(title),
      ),
      body: userBuilder == null ? _list(children!) : _userBody(context, ref),
    );
  }

  Widget _userBody(BuildContext context, WidgetRef ref) {
    return ref.watch(viroUserProvider).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => ViroErrorState(
            message: AppCopy.settings.loadProfileError,
            onRetry: () => ref.invalidate(viroUserProvider),
          ),
          data: (user) => user == null
              ? ViroEmptyState(message: AppCopy.settings.profileNotFound)
              : _list(userBuilder!(context, user)),
        );
  }

  Widget _list(List<Widget> items) {
    return ListView(
      padding: const EdgeInsets.all(ViroSpacing.lg),
      children: items,
    );
  }
}
