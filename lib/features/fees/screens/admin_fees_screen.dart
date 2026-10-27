import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_bulk_action_sheet.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_config_tab.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_mark_paid_dialogs.dart';
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
    final palette = context.viroPalette;
    return FilterChip(
      label: Text(
        label,
        style: TextStyle(
          color: selected ? ViroColors.white : palette.readableAccent(accent),
          fontWeight: FontWeight.w600,
        ),
      ),
      selected: selected,
      onSelected: onSelected,
      showCheckmark: false,
      selectedColor: accent,
      backgroundColor: palette.surfaceSubtle,
      side: BorderSide(color: selected ? accent : palette.border),
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
                icon: ViroIcon(ViroIcons.edit),
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

  /// Enregistre le reste dû (espèces) pour chaque membre sélectionné,
  /// après confirmation et avec un dialog de progression bloquant.
  Future<void> _bulkMarkRemainingPaid(FeeSeason season) async {
    final fees = ref.read(allMemberFeesProvider(widget.clubId)).value ?? [];
    final byId = {for (final fee in fees) fee.memberId: fee};
    final eligible = <MemberFee>[
      for (final memberId in _selectedIds)
        if (byId[memberId] case final fee?)
          if (fee.status != MemberFeeStatus.exonere &&
              fee.tierId != null &&
              fee.tierId!.isNotEmpty &&
              fee.remainingCents(season) > 0)
            fee,
    ];

    if (eligible.isEmpty) {
      ViroSnackBar.show(context, AppCopy.fees.markPaidBulkNone);
      return;
    }

    final totalCents = eligible.fold<int>(
      0,
      (sum, fee) => sum + fee.remainingCents(season),
    );
    final confirmed = await showFeeMarkPaidConfirmDialog(
      context,
      title: AppCopy.fees.markPaidConfirmTitle(eligible.length),
      body: AppCopy.fees.markPaidBulkConfirmBody(
        totalAmount: formatFeeAmountCents(totalCents),
        skipped: _selectedIds.length - eligible.length,
      ),
    );
    if (!confirmed || !mounted) return;

    final progress = ValueNotifier<int>(0);
    final rootNavigator = Navigator.of(context, rootNavigator: true);
    FeeBulkProgressDialog.show(
      context,
      progress: progress,
      total: eligible.length,
    );
    Object? failure;
    try {
      final feeService = ref.read(feeServiceProvider);
      for (final fee in eligible) {
        await feeService.validateOfflinePayment(
          clubId: widget.clubId,
          seasonId: season.id,
          memberId: fee.memberId,
          offlineMethod: FeePaymentMethods.especes,
          amountCents: fee.remainingCents(season),
          season: season,
          currentFee: fee,
        );
        progress.value += 1;
      }
    } catch (error) {
      failure = error;
    } finally {
      rootNavigator.pop();
    }
    final applied = progress.value;
    progress.dispose();
    if (!mounted) return;

    if (failure != null) {
      ViroSnackBar.show(
        context,
        AppCopy.fees.markPaidBulkInterrupted(
          done: applied,
          total: eligible.length,
          detail: AppCopy.common.errorWithDetails(failure),
        ),
      );
      return;
    }
    setState(() {
      _selectionMode = false;
      _selectedIds.clear();
    });
    ViroSnackBar.show(context, AppCopy.fees.markPaidBulkDone(applied));
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
