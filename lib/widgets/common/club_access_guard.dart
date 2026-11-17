import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/models/club_access.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Garde d'écran unique : affiche [child] si [allow] accorde l'accès au
/// compte connecté dans [clubId] (droits de sa fiche, voir [ClubAccess]).
///
/// Posée dans les builders de `lib/config/routes.dart`, pas dans les écrans.
/// Pendant le chargement de la fiche : loader. Refus : redirection vers
/// [deniedRedirect] si fourni (ex. « ma cotisation »), sinon état vide avec
/// retour au club. Les règles Firestore restent la vraie barrière.
class ClubAccessGuard extends ConsumerWidget {
  const ClubAccessGuard({
    super.key,
    required this.clubId,
    required this.allow,
    required this.child,
    this.deniedRedirect,
  });

  final String clubId;
  final bool Function(ClubAccess access) allow;
  final Widget child;

  /// Route de repli en cas de refus (remplace la page courante).
  final String? deniedRedirect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(clubAccessLoadingProvider(clubId))) {
      return const ViroScaffold(body: Center(child: ViroLogoLoader()));
    }
    if (allow(ref.watch(clubAccessProvider(clubId)))) return child;

    final clubRoute = AppRoutes.clubDetailPath(clubId);
    final redirect = deniedRedirect;
    if (redirect != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.replace(redirect);
      });
      return const ViroScaffold(body: Center(child: ViroLogoLoader()));
    }
    return ViroScaffold(
      fallbackRoute: clubRoute,
      appBar: ViroAppBar(
        fallbackRoute: clubRoute,
        title: Text(AppCopy.permissions.accessDeniedTitle),
      ),
      body: ViroEmptyState(
        icon: ViroIcons.lock,
        message: AppCopy.permissions.accessDenied,
        hint: AppCopy.permissions.accessDeniedHint,
        actionLabel: AppCopy.permissions.backToClub,
        onAction: () => context.go(clubRoute),
      ),
    );
  }
}
