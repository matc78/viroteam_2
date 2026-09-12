import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_bulk_action_sheet.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_config_tab.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_members_tracking_tab.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Admin cotisations : configuration saison + suivi membres.
class AdminFeesScreen extends ConsumerStatefulWidget {
  const AdminFeesScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<AdminFeesScreen> createState() => _AdminFeesScreenState();
}

class _AdminFeesScreenState extends ConsumerState<AdminFeesScreen> {
  /// `config` | `tracking` — null tant que la saison n'est pas résolue.
  String? _section;
  bool _didApplyDefaultSection = false;
  String? _tierFilter;
  final _searchCtrl = TextEditingController();
  String _search = '';
  bool _selectionMode = false;
  final _selectedIds = <String>{};

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(
      () => setState(() => _search = _searchCtrl.text.trim().toLowerCase()),
    );
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Widget _sectionChip({
    required String label,
    required bool selected,
    required ValueChanged<bool> onSelected,
    required Color accent,
  }) {
    return FilterChip(
      label: Text(
        label,
        style: TextStyle(
          color: selected ? ViroColors.white : accent,
          fontWeight: FontWeight.w600,
        ),
      ),
      selected: selected,
      onSelected: onSelected,
      showCheckmark: false,
      selectedColor: accent,
      backgroundColor: ViroColors.gray50,
      side: BorderSide(color: selected ? accent : ViroColors.gray200),
    );
  }

  void _openConfigTab() => setState(() => _section = 'config');

  void _openTrackingTab() => setState(() => _section = 'tracking');

  void _ensureDefaultSection(AsyncValue<FeeSeason?> seasonAsync) {
    if (_didApplyDefaultSection) return;
    if (!seasonAsync.hasValue && !seasonAsync.hasError) return;
    _didApplyDefaultSection = true;
    _section = seasonAsync.asData?.value != null ? 'tracking' : 'config';
  }

  @override
  Widget build(BuildContext context) {
    final member = ref.watch(clubMemberProvider(widget.clubId)).value;
    final accent = ref.watch(clubManagementAccentProvider(widget.clubId));
    final memberAccent = ref.watch(clubMemberAccentProvider(widget.clubId));
    final seasonAsync = ref.watch(activeSeasonProvider(widget.clubId));

    _ensureDefaultSection(seasonAsync);

    if (member != null && member.role != MemberRoles.admin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.replace(AppRoutes.clubMyFeePath(widget.clubId));
      });
      return const ViroScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final section = _section;

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
        appBar: ViroAppBar(
          title: Text(AppCopy.fees.screenTitle),
          actions: [
            if (section == 'tracking' && _selectionMode)
              TextButton(
                onPressed: () => setState(() {
                  _selectionMode = false;
                  _selectedIds.clear();
                }),
                child: Text(AppCopy.common.cancel),
              ),
          ],
        ),
        body: section == null
            ? const Center(child: CircularProgressIndicator())
            : Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(
                ViroSpacing.screenHorizontal,
                ViroSpacing.md,
                ViroSpacing.screenHorizontal,
                ViroSpacing.xs,
              ),
              child: Row(
                children: [
                  _sectionChip(
                    label: AppCopy.fees.tabConfig,
                    selected: section == 'config',
                    accent: accent,
                    onSelected: (_) => _openConfigTab(),
                  ),
                  const SizedBox(width: ViroSpacing.xs),
                  _sectionChip(
                    label: AppCopy.fees.tabTracking,
                    selected: section == 'tracking',
                    accent: accent,
                    onSelected: (_) => _openTrackingTab(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: section == 'config'
                  ? FeeConfigTab(
                      clubId: widget.clubId,
                      accentColor: accent,
                      onSaved: _openTrackingTab,
                    )
                  : FeeMembersTrackingTab(
                      clubId: widget.clubId,
                      accentColor: accent,
                      tierFilter: _tierFilter,
                      onTierFilterChanged: (value) =>
                          setState(() => _tierFilter = value),
                      searchCtrl: _searchCtrl,
                      search: _search,
                      selectionMode: _selectionMode,
                      selectedIds: _selectedIds,
                      onToggleSelection: () => setState(() {
                        _selectionMode = !_selectionMode;
                        if (!_selectionMode) _selectedIds.clear();
                      }),
                      onSelect: (id, selected) => setState(() {
                        if (selected) {
                          _selectedIds.add(id);
                        } else {
                          _selectedIds.remove(id);
                        }
                      }),
                      onOpenBulk: _openBulkActions,
                      onOpenConfig: _openConfigTab,
                    ),
            ),
          ],
        ),
        floatingActionButton: section == 'tracking' &&
                _selectionMode &&
                _selectedIds.isNotEmpty
            ? FloatingActionButton.extended(
                onPressed: _openBulkActions,
                icon: ViroIcon(ViroIcons.edit, color: Colors.white),
                label: Text(AppCopy.fees.selectedCountLabel(_selectedIds.length)),
              )
            : null,
      ),
    );
  }

  void _openBulkActions() {
    final season = ref.read(activeSeasonProvider(widget.clubId)).value;
    if (season == null) return;
    FeeBulkActionSheet.show(
      context,
      selectedCount: _selectedIds.length,
      tiers: season.tiers,
      onMarkPaid: () => _bulkMarkRemainingPaid(season),
      onAssignTier: (tierId) => _bulkTier(tierId, season),
    );
  }

  /// Enregistre le reste dû (espèces) pour chaque membre sélectionné.
  Future<void> _bulkMarkRemainingPaid(FeeSeason season) async {
    final fees = ref.read(allMemberFeesProvider(widget.clubId)).value ?? [];
    final byId = {for (final fee in fees) fee.memberId: fee};
    var applied = 0;
    try {
      for (final memberId in _selectedIds) {
        final fee = byId[memberId];
        if (fee == null) continue;
        if (fee.status == MemberFeeStatus.exonere) continue;
        if (fee.tierId == null || fee.tierId!.isEmpty) continue;
        final remaining = fee.remainingCents(season);
        if (remaining <= 0) continue;
        await ref.read(feeServiceProvider).validateOfflinePayment(
              clubId: widget.clubId,
              seasonId: season.id,
              memberId: memberId,
              offlineMethod: FeePaymentMethods.especes,
              amountCents: remaining,
              season: season,
              currentFee: fee,
            );
        applied += 1;
      }
      setState(() {
        _selectionMode = false;
        _selectedIds.clear();
      });
      if (mounted) {
        ViroSnackBar.show(
          context,
          applied > 0 ? AppCopy.fees.updateDone : AppCopy.fees.noMembersToShow,
        );
      }
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(error));
      }
    }
  }

  Future<void> _bulkTier(String tierId, FeeSeason season) async {
    try {
      await ref.read(feeServiceProvider).bulkSetTier(
            clubId: widget.clubId,
            seasonId: season.id,
            memberIds: _selectedIds.toList(),
            tierId: tierId,
            season: season,
          );
      setState(() {
        _selectionMode = false;
        _selectedIds.clear();
      });
      if (mounted) ViroSnackBar.show(context, AppCopy.fees.tiersAssigned);
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(error));
      }
    }
  }
}
