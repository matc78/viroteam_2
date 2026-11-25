import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/teams/widgets/team_federation_link_sheet.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_selectable_row.dart';

/// Bloc « calendrier FFVB » d'une équipe (onglet Gérer) : appel à lier le
/// calendrier, ou poule liée + état de la synchro (tap = classement, menu ⋮
/// Actualiser / Délier).
class TeamFederationSection extends ConsumerStatefulWidget {
  const TeamFederationSection({
    super.key,
    required this.team,
    required this.accent,
  });

  final ClubTeam team;
  final Color accent;

  @override
  ConsumerState<TeamFederationSection> createState() =>
      _TeamFederationSectionState();
}

class _TeamFederationSectionState extends ConsumerState<TeamFederationSection> {
  bool _busy = false;

  /// Affiche un dialog bloquant avec [ViroLogoLoader] pendant [action].
  Future<T?> _withBusyDialog<T>(Future<T> Function() action) async {
    // Navigator capturé avant l'appel : le dialog (non fermable) doit être
    // retiré même si la carte est démontée pendant la synchro.
    final navigator = Navigator.of(context, rootNavigator: true);
    setState(() => _busy = true);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => PopScope(
        canPop: false,
        child: AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ViroLogoLoader(size: 56),
              const SizedBox(height: ViroSpacing.md),
              Text(
                AppCopy.standings.refreshing,
                textAlign: TextAlign.center,
                style: Theme.of(dialogContext).textTheme.bodyMedium?.copyWith(
                  color: dialogContext.viroPalette.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
    try {
      return await action();
    } finally {
      navigator.pop();
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refresh() async {
    try {
      final result = await _withBusyDialog(
        () => ref
            .read(teamFederationServiceProvider)
            .refresh(clubId: widget.team.clubId, teamId: widget.team.id),
      );
      if (!mounted || result == null) return;
      ViroSnackBar.show(
        context,
        AppCopy.standings.refreshed(result.created + result.updated),
      );
    } catch (error) {
      if (!mounted) return;
      final tooSoon =
          error is FirebaseFunctionsException &&
          error.code == 'resource-exhausted';
      ViroSnackBar.show(
        context,
        tooSoon
            ? AppCopy.standings.refreshTooSoon
            : callableErrorMessage(
                error,
                fallback: AppCopy.standings.siteUnavailable,
              ),
      );
    }
  }

  /// Confirme le délien ; `null` si annulé, sinon `true` pour supprimer
  /// aussi les matchs importés.
  Future<bool?> _confirmUnlink() {
    final copy = AppCopy.standings;
    var deleteMatches = false;
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) {
          final palette = dialogContext.viroPalette;
          return AlertDialog(
            title: Text(copy.unlinkTitle),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(copy.unlinkBody),
                const SizedBox(height: ViroSpacing.md),
                ViroSelectableRow(
                  selected: deleteMatches,
                  accentColor: widget.accent,
                  title: copy.deleteImportedMatches,
                  subtitle: Text(
                    copy.deleteImportedMatchesHint,
                    style: Theme.of(dialogContext).textTheme.bodySmall
                        ?.copyWith(color: palette.textSecondary),
                  ),
                  onChanged: (selected) =>
                      setDialogState(() => deleteMatches = selected),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: Text(AppCopy.common.cancel),
              ),
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, deleteMatches),
                child: Text(
                  copy.unlink,
                  style: TextStyle(color: palette.errorText),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _unlink() async {
    final deleteMatches = await _confirmUnlink();
    if (deleteMatches == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final deleted = await ref
          .read(teamFederationServiceProvider)
          .unlink(
            clubId: widget.team.clubId,
            teamId: widget.team.id,
            deleteImportedMatches: deleteMatches,
          );
      if (mounted) {
        ViroSnackBar.show(
          context,
          deleteMatches
              ? AppCopy.standings.unlinkedWithMatches(deleted)
              : AppCopy.standings.unlinked,
        );
      }
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          callableErrorMessage(error, fallback: AppCopy.standings.actionFailed),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final team = widget.team;
    final link = team.federation;
    final copy = AppCopy.standings;

    if (link == null) {
      return _FederationBlock(
        accent: widget.accent,
        icon: ViroIcons.link,
        title: copy.linkAction,
        subtitle: copy.linkActionHint,
        onTap: () => showTeamFederationLinkSheet(
          context,
          team: team,
          accent: widget.accent,
        ),
        trailing: ViroIcon(
          ViroIcons.chevronRight,
          size: 18,
          color: palette.textMuted,
        ),
      );
    }

    final lastSync = link.lastSyncAt;
    final status = lastSync == null
        ? copy.syncPending
        : copy.syncedAt(lastSync, DateTime.now());

    return _FederationBlock(
      accent: widget.accent,
      icon: ViroIcons.trophyOutline,
      title: copy.linkedSummary(link.pool ?? link.teamName),
      subtitle: link.lastSyncFailed ? copy.syncFailed : status,
      subtitleIsWarning: link.lastSyncFailed,
      onTap: () => context.push(
        AppRoutes.clubTeamStandingsPath(team.clubId, team.id),
      ),
      trailing: PopupMenuButton<_FederationAction>(
        tooltip: AppCopy.common.moreActions,
        enabled: !_busy,
        icon: ViroIcon(ViroIcons.moreVertical, color: palette.textSecondary),
        onSelected: (action) {
          switch (action) {
            case _FederationAction.refresh:
              _refresh();
            case _FederationAction.unlink:
              _unlink();
          }
        },
        itemBuilder: (menuContext) => [
          PopupMenuItem(
            value: _FederationAction.refresh,
            child: Text(copy.refresh),
          ),
          PopupMenuItem(
            value: _FederationAction.unlink,
            child: Text(
              copy.unlink,
              style: TextStyle(color: menuContext.viroPalette.errorText),
            ),
          ),
        ],
      ),
    );
  }
}

enum _FederationAction { refresh, unlink }

/// Bloc teinté couleur club, tappable : icône, titre, sous-titre, action.
class _FederationBlock extends StatelessWidget {
  const _FederationBlock({
    required this.accent,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    required this.trailing,
    this.subtitleIsWarning = false,
  });

  final Color accent;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Widget trailing;
  final bool subtitleIsWarning;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final style = ClubAccentStyle(accent);
    final accentText = palette.readableAccent(accent);
    final radius = BorderRadius.circular(ViroSpacing.buttonRadius + 4);

    return Padding(
      padding: const EdgeInsets.only(top: ViroSpacing.sm),
      child: ViroPressable(
        floating: false,
        borderRadius: radius,
        onTap: onTap,
        label: title,
        child: Container(
          padding: const EdgeInsets.only(
            left: ViroSpacing.md - 4,
            top: ViroSpacing.xs,
            bottom: ViroSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: style.surfaceTint,
            borderRadius: radius,
            border: Border.all(color: style.border),
          ),
          child: Row(
            children: [
              ViroIcon(icon, size: 22, color: accentText),
              const SizedBox(width: ViroSpacing.sm + 4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: palette.brandText,
                      ),
                    ),
                    Row(
                      children: [
                        if (subtitleIsWarning) ...[
                          ViroIcon(
                            ViroIcons.warning,
                            size: 14,
                            color: palette.warningText,
                          ),
                          const SizedBox(width: ViroSpacing.xs),
                        ],
                        Expanded(
                          child: Text(
                            subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: theme.bodySmall?.copyWith(
                              color: subtitleIsWarning
                                  ? palette.warningText
                                  : palette.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: ViroSpacing.minTouchTarget,
                child: Center(child: trailing),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
