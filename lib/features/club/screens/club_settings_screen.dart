import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/utils/coach_permission_labels.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/season_end.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Paramètres club admin : fin de saison et droits coachs (aligné portail `/settings`).
class ClubSettingsScreen extends ConsumerStatefulWidget {
  const ClubSettingsScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubSettingsScreen> createState() => _ClubSettingsScreenState();
}

class _ClubSettingsScreenState extends ConsumerState<ClubSettingsScreen> {
  DateTime? _seasonEndDraft;
  CoachPermissions? _permissionsDraft;
  bool _saving = false;
  bool _allowPop = false;
  String? _seasonError;

  bool _coachDirty(CoachPermissions current) {
    final draft = _permissionsDraft;
    if (draft == null) return false;
    return draft.canCreateEvents != current.canCreateEvents ||
        draft.canManageTeamRoster != current.canManageTeamRoster ||
        draft.canInvitePlayers != current.canInvitePlayers ||
        draft.canTakeAttendance != current.canTakeAttendance ||
        draft.canViewFees != current.canViewFees ||
        draft.canEditMemberLicenses != current.canEditMemberLicenses;
  }

  bool _seasonDirty(DateTime? configured) {
    final draft = _seasonEndDraft;
    if (draft == null) return false;
    final current = resolveSeasonEndDate(configured);
    return !_sameDay(draft, current);
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  void _syncFromClub(CoachPermissions permissions, DateTime? seasonEndDate) {
    _permissionsDraft ??= permissions;
    _seasonEndDraft ??= resolveSeasonEndDate(seasonEndDate);
  }

  Future<void> _pickSeasonDate() async {
    final initial = _seasonEndDraft ?? defaultSeasonEndDate();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(DateTime.now().year - 1),
      lastDate: maxSeasonEndDate().add(const Duration(days: 365)),
      locale: const Locale('fr', 'FR'),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _seasonEndDraft = picked;
      _seasonError = isSeasonEndAfterMax(picked)
          ? AppCopy.club.seasonEndAfterMax(
              DateFormat('dd/MM/yyyy').format(maxSeasonEndDate()),
            )
          : null;
    });
  }

  bool _hasChanges(Club club) =>
      _seasonDirty(club.seasonEndDate) || _coachDirty(club.coachPermissions);

  /// Enregistre en une fois la fin de saison et les droits coachs modifiés.
  Future<void> _saveAll(Club club) async {
    final seasonDraft = _seasonEndDraft;
    final permissionsDraft = _permissionsDraft;
    final saveSeason = seasonDraft != null && _seasonDirty(club.seasonEndDate);
    final saveCoach =
        permissionsDraft != null && _coachDirty(club.coachPermissions);
    if (!saveSeason && !saveCoach) return;
    if (saveSeason && isSeasonEndAfterMax(seasonDraft)) {
      setState(() => _seasonError = AppCopy.club.invalidDate);
      return;
    }

    setState(() {
      _saving = true;
      _seasonError = null;
    });
    final clubService = ref.read(clubServiceProvider);
    try {
      if (saveSeason) {
        await clubService.updateSeasonEndDate(
          clubId: widget.clubId,
          seasonEndDate: seasonDraft,
        );
      }
      if (saveCoach) {
        await clubService.updateCoachPermissions(
          clubId: widget.clubId,
          permissions: permissionsDraft,
        );
      }
      invalidateClubVisualCaches(ref, widget.clubId);
      if (mounted) ViroSnackBar.show(context, AppCopy.club.settingsSaved);
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          callableErrorMessage(
            error,
            fallback: AppCopy.club.settingsSaveFailed,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Demande confirmation avant de quitter avec des modifications en cours.
  Future<void> _confirmDiscard() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppCopy.club.discardChangesTitle),
        content: Text(AppCopy.club.discardChangesBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(AppCopy.common.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(AppCopy.club.discardChangesAction),
          ),
        ],
      ),
    );
    if (leave != true || !mounted) return;
    setState(() => _allowPop = true);
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.clubDetailPath(widget.clubId));
    }
  }

  bool _permissionValue(CoachPermissions permissions, int index) {
    return switch (index) {
      0 => permissions.canCreateEvents,
      1 => permissions.canManageTeamRoster,
      2 => permissions.canInvitePlayers,
      3 => permissions.canTakeAttendance,
      4 => permissions.canViewFees,
      _ => permissions.canEditMemberLicenses,
    };
  }

  void _togglePermission(int index, bool enabled) {
    final current = _permissionsDraft ?? CoachPermissions.defaults;
    setState(() {
      _permissionsDraft = coachPermissionLabels[index].apply(current, enabled);
    });
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final member = ref.watch(clubMemberProvider(clubId)).value;
    final clubAsync = ref.watch(clubProvider(clubId));
    final memberAccent = ref.watch(clubMemberAccentProvider(clubId));
    final managementAccent = ref.watch(clubManagementAccentProvider(clubId));
    final palette = context.viroPalette;
    final readableManagementAccent = palette.readableAccent(managementAccent);

    final clubRoute = AppRoutes.clubDetailPath(clubId);

    if (member != null && member.role != MemberRoles.admin) {
      return ViroScaffold(
        fallbackRoute: clubRoute,
        appBar: ViroAppBar(
          fallbackRoute: clubRoute,
          title: Text(AppCopy.club.settingsTitle),
        ),
        body: ViroEmptyState(
          icon: ViroIcons.block,
          message: AppCopy.club.settingsAdminOnly,
          actionLabel: AppCopy.club.backToClub,
          onAction: () => context.go(clubRoute),
        ),
      );
    }

    final club = clubAsync.value;
    final hasChanges = club != null && _hasChanges(club);

    return PopScope(
      canPop: !hasChanges || _allowPop,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmDiscard();
      },
      child: ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
        // Avec des modifications en cours, le PopScope ci-dessus décide seul
        // (sinon celui du scaffold renverrait vers le club sans confirmer).
        fallbackRoute: hasChanges ? null : clubRoute,
        appBar: ViroAppBar(
          fallbackRoute: clubRoute,
          leading: hasChanges
              ? IconButton(
                  tooltip: AppCopy.common.back,
                  icon: ViroIcon(ViroIcons.chevronLeft),
                  onPressed: _confirmDiscard,
                )
              : null,
          title: Text(AppCopy.club.settingsTitle),
        ),
        body: clubAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => ViroErrorState(
            onRetry: () => ref.invalidate(clubProvider(clubId)),
          ),
          data: (club) {
            if (club == null) {
              return Center(child: Text(AppCopy.common.clubNotFound));
            }

            _syncFromClub(club.coachPermissions, club.seasonEndDate);
            final permissions = _permissionsDraft ?? club.coachPermissions;
            final seasonDraft =
                _seasonEndDraft ?? resolveSeasonEndDate(club.seasonEndDate);
            final dateLabel = DateFormat('dd/MM/yyyy').format(seasonDraft);

            return ListView(
              padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
              children: [
                Text(
                  AppCopy.club.configureClubIntro(club.name),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                ),
                const SizedBox(height: ViroSpacing.lg),
                Text(
                  AppCopy.club.locationsSectionTitle,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: readableManagementAccent,
                      ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  AppCopy.club.locationsSectionHelper,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroCard(
                  accentColor: managementAccent,
                  margin: EdgeInsets.zero,
                  child: ListTile(
                    leading: ViroIcon(
                      ViroIcons.place,
                      color: readableManagementAccent,
                    ),
                    title: Text(
                      AppCopy.club.manageLocations,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text(
                      club.practiceLocations.isEmpty
                          ? AppCopy.club.noLocations
                          : AppCopy.club.locationsCount(
                              club.practiceLocations.length,
                            ),
                    ),
                    trailing: ViroIcon(
                      ViroIcons.chevronRight,
                      color: readableManagementAccent,
                    ),
                    onTap: () => context.push(
                      AppRoutes.clubLocationsPath(clubId),
                    ),
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
                Text(
                  AppCopy.club.seasonEndSectionTitle,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: readableManagementAccent,
                      ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  AppCopy.club.seasonEndHelper,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroCard(
                  accentColor: managementAccent,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ListTile(
                        title: Text(AppCopy.club.seasonEndDateLabel),
                        subtitle: Text(dateLabel),
                        trailing: ViroIcon(
                          ViroIcons.calendar,
                          color: readableManagementAccent,
                        ),
                        onTap: _saving ? null : _pickSeasonDate,
                      ),
                      if (_seasonError != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            ViroSpacing.md,
                            0,
                            ViroSpacing.md,
                            ViroSpacing.md,
                          ),
                          child: Text(
                            _seasonError!,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: palette.errorText),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
                Text(
                  AppCopy.club.coachRightsSectionTitle,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: readableManagementAccent,
                      ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  AppCopy.club.coachRightsHelper,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroCard(
                  accentColor: managementAccent,
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (var index = 0;
                          index < coachPermissionLabels.length;
                          index++) ...[
                        if (index > 0)
                          Divider(
                            height: 1,
                            color: palette.border,
                          ),
                        SwitchListTile(
                          title: Text(coachPermissionLabels[index].label),
                          subtitle: Text(
                            coachPermissionLabels[index].description,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: palette.textSecondary),
                          ),
                          value: _permissionValue(permissions, index),
                          activeThumbColor: managementAccent,
                          onChanged: _saving
                              ? null
                              : (enabled) => _togglePermission(index, enabled),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.lg),
                ViroPrimaryButton(
                  label: _saving
                      ? AppCopy.common.saving
                      : hasChanges
                          ? AppCopy.club.saveSettings
                          : AppCopy.club.settingsUpToDate,
                  isLoading: _saving,
                  onPressed: _saving || !hasChanges
                      ? null
                      : () => _saveAll(club),
                ),
                const SizedBox(height: ViroSpacing.xl),
              ],
            );
          },
        ),
      ),
      ),
    );
  }
}
