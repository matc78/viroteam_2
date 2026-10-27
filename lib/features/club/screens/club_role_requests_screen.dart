import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/navigation_fallback.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/providers/role_requests_providers.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/section_shimmer.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/role_request_list_tile.dart';

/// Admin : demandes de rôle traitables du club, une carte par demande.
class ClubRoleRequestsScreen extends ConsumerStatefulWidget {
  const ClubRoleRequestsScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubRoleRequestsScreen> createState() =>
      _ClubRoleRequestsScreenState();
}

class _ClubRoleRequestsScreenState
    extends ConsumerState<ClubRoleRequestsScreen> {
  /// Demandes en cours d'envoi, puis masquées en attendant le flux.
  final _busyIds = <String>{};
  final _doneIds = <String>{};

  Future<void> _resolve(ActionableRoleRequest item, {required bool accept}) async {
    final name = item.member.fullName.trim().isNotEmpty
        ? item.member.fullName.trim()
        : AppCopy.club.roleRequestFallbackName;

    if (!accept) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(AppCopy.club.roleRequestRefuseTitle),
          content: Text(AppCopy.club.roleRequestRefuseBody(name)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(AppCopy.common.cancel),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(AppCopy.club.roleRequestRefuse),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }

    final requestId = item.request.id;
    setState(() => _busyIds.add(requestId));
    try {
      await ref.read(joinRequestServiceProvider).resolveRequest(
            requestId: requestId,
            accept: accept,
          );
      if (accept) ref.invalidate(clubMemberProvider(widget.clubId));
      if (!mounted) return;
      setState(() => _doneIds.add(requestId));
      ViroSnackBar.show(
        context,
        accept
            ? AppCopy.club.roleRequestAccepted(name)
            : AppCopy.club.roleRequestRefused(name),
      );
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          callableErrorMessage(
            error,
            fallback: AppCopy.club.roleRequestFailed,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyIds.remove(requestId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final clubRoute = AppRoutes.clubDetailPath(clubId);
    final accent = ref.watch(clubMemberAccentProvider(clubId));
    final requestsAsync = ref.watch(actionableRoleRequestsProvider(clubId));
    final palette = context.viroPalette;

    return ClubAccentTheme(
      accentColor: accent,
      child: ViroScaffold(
        fallbackRoute: clubRoute,
        appBar: ViroAppBar(
          fallbackRoute: clubRoute,
          title: Text(AppCopy.club.roleRequestsTitle),
        ),
        body: requestsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(ViroSpacing.screenHorizontal),
            child: SectionShimmer(itemCount: 2),
          ),
          error: (_, _) => ViroErrorState(
            message: AppCopy.club.roleRequestsLoadError,
            onRetry: () => ref.invalidate(pendingRoleRequestsProvider(clubId)),
          ),
          data: (all) {
            final items =
                all.where((item) => !_doneIds.contains(item.request.id)).toList();
            if (items.isEmpty) {
              return ViroEmptyState(
                icon: ViroIcons.checkCircle,
                message: AppCopy.club.roleRequestsEmpty,
                actionLabel: AppCopy.club.backToClub,
                onAction: () => popOrGo(context, clubRoute),
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
              itemCount: items.length + 1,
              itemBuilder: (_, index) => index == 0
                  ? Padding(
                      padding: const EdgeInsets.only(bottom: ViroSpacing.md),
                      child: Text(
                        AppCopy.club.roleRequestsIntro,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: palette.textSecondary,
                            ),
                      ),
                    )
                  : RoleRequestListTile(
                      request: items[index - 1].request,
                      member: items[index - 1].member,
                      accentColor: accent,
                      busy: _busyIds.contains(items[index - 1].request.id),
                      onAccept: () => _resolve(items[index - 1], accept: true),
                      onRefuse: () => _resolve(items[index - 1], accept: false),
                    ),
            );
          },
        ),
      ),
    );
  }
}
