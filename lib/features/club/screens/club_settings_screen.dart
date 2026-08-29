import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/utils/coach_permission_labels.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
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
  ConsumerState<ClubSettingsScreen> createState() =>
      _ClubSettingsScreenState();
}

class _ClubSettingsScreenState extends ConsumerState<ClubSettingsScreen> {
  DateTime? _seasonEndDraft;
  CoachPermissions? _permissionsDraft;
  bool _seasonBusy = false;
  bool _coachBusy = false;
  String? _seasonError;

  bool _coachDirty(CoachPermissions current) {
    final draft = _permissionsDraft;
    if (draft == null) return false;
    return draft.canCreateEvents != current.canCreateEvents ||
        draft.canManageTeamRoster != current.canManageTeamRoster ||
        draft.canInvitePlayers != current.canInvitePlayers ||
        draft.canTakeAttendance != current.canTakeAttendance ||
        draft.canViewFees != current.canViewFees;
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
          ? 'La fin de saison ne peut pas dépasser le '
              '${DateFormat('dd/MM/yyyy').format(maxSeasonEndDate())} (31 juillet).'
          : null;
    });
  }

  Future<void> _saveSeason(DateTime? configured) async {
    final draft = _seasonEndDraft;
    if (draft == null || !_seasonDirty(configured)) return;
    if (isSeasonEndAfterMax(draft)) {
      setState(() => _seasonError = 'Date invalide.');
      return;
    }

    setState(() {
      _seasonBusy = true;
      _seasonError = null;
    });
    try {
      await ref.read(clubServiceProvider).updateSeasonEndDate(
            clubId: widget.clubId,
            seasonEndDate: draft,
          );
      invalidateClubVisualCaches(ref, widget.clubId);
      if (mounted) ViroSnackBar.show(context, 'Fin de saison enregistrée');
    } catch (error) {
      if (mounted) {
        setState(() => _seasonError = error.toString());
      }
    } finally {
      if (mounted) setState(() => _seasonBusy = false);
    }
  }

  Future<void> _saveCoachPermissions(CoachPermissions current) async {
    final draft = _permissionsDraft;
    if (draft == null || !_coachDirty(current)) return;

    setState(() => _coachBusy = true);
    try {
      await ref.read(clubServiceProvider).updateCoachPermissions(
            clubId: widget.clubId,
            permissions: draft,
          );
      invalidateClubVisualCaches(ref, widget.clubId);
      if (mounted) ViroSnackBar.show(context, 'Droits coachs enregistrés');
    } catch (error) {
      if (mounted) ViroSnackBar.show(context, error.toString());
    } finally {
      if (mounted) setState(() => _coachBusy = false);
    }
  }

  bool _permissionValue(CoachPermissions permissions, int index) {
    return switch (index) {
      0 => permissions.canCreateEvents,
      1 => permissions.canManageTeamRoster,
      2 => permissions.canInvitePlayers,
      3 => permissions.canTakeAttendance,
      _ => permissions.canViewFees,
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

    if (member != null && member.role != MemberRoles.admin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.pop();
      });
      return const ViroScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
        appBar: ViroAppBar(
          leading: IconButton(
            icon: ViroIcon(ViroIcons.chevronLeft),
            onPressed: () => context.pop(),
          ),
          title: const Text('Paramètres'),
        ),
        body: clubAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => const ViroErrorState(),
          data: (club) {
            if (club == null) {
              return const Center(child: Text('Club introuvable'));
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
                  'Configurer ${club.name} : saison et droits des coachs.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                ),
                const SizedBox(height: ViroSpacing.lg),
                Text(
                  'Fin de saison',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: managementAccent,
                      ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  'Date limite pour le planning et les récurrences.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroCard(
                  accentColor: managementAccent,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ListTile(
                        title: const Text('Date de fin'),
                        subtitle: Text(dateLabel),
                        trailing: ViroIcon(
                          ViroIcons.calendar,
                          color: managementAccent,
                        ),
                        onTap: _seasonBusy ? null : _pickSeasonDate,
                      ),
                      if (_seasonError != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: ViroSpacing.md,
                          ),
                          child: Text(
                            _seasonError!,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: ViroColors.error),
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.all(ViroSpacing.md),
                        child: ViroPrimaryButton(
                          label: _seasonBusy
                              ? 'Enregistrement…'
                              : 'Enregistrer la fin de saison',
                          isLoading: _seasonBusy,
                          onPressed: _seasonBusy ||
                                  !_seasonDirty(club.seasonEndDate)
                              ? null
                              : () => _saveSeason(club.seasonEndDate),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
                Text(
                  'Droits coachs',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: managementAccent,
                      ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  'Contrôle des actions visibles pour les coachs du club.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
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
                            color: ViroColors.gray200,
                          ),
                        SwitchListTile(
                          title: Text(coachPermissionLabels[index].label),
                          subtitle: Text(
                            coachPermissionLabels[index].description,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: ViroColors.gray600),
                          ),
                          value: _permissionValue(permissions, index),
                          activeThumbColor: managementAccent,
                          onChanged: _coachBusy
                              ? null
                              : (enabled) =>
                                  _togglePermission(index, enabled),
                        ),
                      ],
                      Padding(
                        padding: const EdgeInsets.all(ViroSpacing.md),
                        child: ViroPrimaryButton(
                          label: _coachBusy
                              ? 'Enregistrement…'
                              : 'Enregistrer les droits coachs',
                          isLoading: _coachBusy,
                          onPressed: _coachBusy ||
                                  !_coachDirty(club.coachPermissions)
                              ? null
                              : () => _saveCoachPermissions(
                                    club.coachPermissions,
                                  ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
              ],
            );
          },
        ),
      ),
    );
  }
}
