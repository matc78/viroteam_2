import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/fees/widgets/member_fee_list_tile.dart';
import 'package:viro_team_v2/features/fees/widgets/offline_payment_dialog.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_payment_history_list.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Membres du club sans fiche `member_fees` pour la saison en cours.
int pendingFeeInitCount({
  required List<ClubMember> members,
  required List<ClubMember> pendingAsMembers,
  required Set<String> existingMemberIds,
}) {
  var n = 0;
  for (final m in [...members, ...pendingAsMembers]) {
    if (!existingMemberIds.contains(m.memberId)) n++;
  }
  return n;
}

class FeeTrackingLists {
  const FeeTrackingLists({
    required this.unpaid,
    required this.upToDate,
  });

  final List<MemberFee> unpaid;
  final List<MemberFee> upToDate;
}

/// Onglet suivi des cotisations membres (admin) — actions terrain.
class FeeMembersTrackingTab extends ConsumerWidget {
  const FeeMembersTrackingTab({
    super.key,
    required this.clubId,
    required this.tierFilter,
    required this.onTierFilterChanged,
    required this.searchCtrl,
    required this.search,
    required this.selectionMode,
    required this.selectedIds,
    required this.onToggleSelection,
    required this.onSelect,
    required this.onOpenBulk,
    this.accentColor,
    this.onOpenConfig,
  });

  final String clubId;
  final String? tierFilter;
  final ValueChanged<String?> onTierFilterChanged;
  final TextEditingController searchCtrl;
  final String search;
  final bool selectionMode;
  final Set<String> selectedIds;
  final VoidCallback onToggleSelection;
  final void Function(String id, bool selected) onSelect;
  final VoidCallback onOpenBulk;
  final Color? accentColor;
  final VoidCallback? onOpenConfig;

  List<MemberFee> _applySearchAndTier(List<MemberFee> fees) {
    return fees.where((f) {
      if (tierFilter != null && f.tierId != tierFilter) return false;
      if (search.isNotEmpty &&
          !f.memberDisplayName.toLowerCase().contains(search)) {
        return false;
      }
      return true;
    }).toList();
  }

  void _sortByName(List<MemberFee> list) {
    list.sort(
      (a, b) => a.memberDisplayName
          .toLowerCase()
          .compareTo(b.memberDisplayName.toLowerCase()),
    );
  }

  FeeTrackingLists _splitFees(List<MemberFee> fees, FeeSeason season) {
    final filtered = _applySearchAndTier(fees);
    final unpaid = <MemberFee>[];
    final upToDate = <MemberFee>[];

    for (final f in filtered) {
      switch (f.displayStatus(season.paymentDeadlineAt)) {
        case MemberFeeDisplayStatus.paye:
        case MemberFeeDisplayStatus.exonere:
          upToDate.add(f);
        case MemberFeeDisplayStatus.aPayer:
        case MemberFeeDisplayStatus.enRetard:
        case MemberFeeDisplayStatus.echeanceAujourdhui:
        case MemberFeeDisplayStatus.partiel:
          unpaid.add(f);
      }
    }

    _sortByName(unpaid);
    _sortByName(upToDate);
    return FeeTrackingLists(unpaid: unpaid, upToDate: upToDate);
  }

  Widget _sectionTitle(BuildContext context, String title) {
    final accent = accentColor ?? ViroColors.primary800;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.md,
        ViroSpacing.screenHorizontal,
        ViroSpacing.xs,
      ),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: accent,
            ),
      ),
    );
  }

  bool _needsFieldActions(MemberFee fee, FeeSeason season) {
    if (fee.status == MemberFeeStatus.exonere) return false;
    if (fee.status == MemberFeeStatus.paye) return false;
    final needsTier = fee.tierId == null || fee.tierId!.isEmpty;
    if (needsTier) return true;
    return fee.remainingCents(season) > 0;
  }

  Widget _feeTile(
    BuildContext context,
    WidgetRef ref,
    MemberFee fee,
    FeeSeason season, {
    required bool actionable,
  }) {
    final selected = selectedIds.contains(fee.memberId);
    return MemberFeeListTile(
      fee: fee,
      season: season,
      selected: selected,
      selectionMode: selectionMode,
      showMenu: actionable && !selectionMode,
      onTap: () {
        if (selectionMode) {
          onSelect(fee.memberId, !selected);
          return;
        }
        if (actionable) {
          _showFieldActions(context, ref, fee, season);
        } else {
          ViroSnackBar.show(context, AppCopy.fees.fieldUpToDateHint);
        }
      },
      onLongPress: () {
        if (!selectionMode) onToggleSelection();
        onSelect(fee.memberId, true);
      },
      onMenu: actionable
          ? () => _showFieldActions(context, ref, fee, season)
          : null,
    );
  }

  Future<void> _initialize(BuildContext context, WidgetRef ref) async {
    final season = ref.read(activeSeasonProvider(clubId)).value;
    if (season == null) return;

    final members = ref.read(clubMembersProvider(clubId)).value ?? [];
    final pending = ref.read(pendingTeamMembersProvider(clubId)).value ?? [];
    final pendingAsMembers =
        pending.map((p) => pendingAsClubMember(p)).toList();
    final teams = ref.read(clubTeamsProvider(clubId)).value ?? [];
    final existing = ref.read(allMemberFeesProvider(clubId)).value ?? [];
    final existingIds = existing.map((f) => f.memberId).toSet();

    final count = pendingFeeInitCount(
      members: members,
      pendingAsMembers: pendingAsMembers,
      existingMemberIds: existingIds,
    );
    if (count <= 0) {
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.fees.allMembersHaveFee);
      }
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppCopy.fees.addToTrackingTitle),
        content: Text(
          AppCopy.fees.createFeeSheetsBody(count),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(AppCopy.common.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(AppCopy.fees.create),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      final created = await ref.read(feeServiceProvider).initializeMemberFees(
            clubId: clubId,
            seasonId: season.id,
            members: members,
            teams: teams,
            pendingAsMembers: pendingAsMembers,
            existingMemberIds: existingIds,
            tiers: season.tiers,
          );
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.fees.sheetsCreated(created));
      }
    } catch (e) {
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
      }
    }
  }

  Future<void> _exportCsv(BuildContext context, WidgetRef ref) async {
    final season = ref.read(activeSeasonProvider(clubId)).value;
    if (season == null) return;
    final fees = ref.read(allMemberFeesProvider(clubId)).value ?? [];
    final csv = await ref.read(feeServiceProvider).exportCsv(
          clubId: clubId,
          seasonId: season.id,
          season: season,
          fees: fees,
        );
    await Clipboard.setData(ClipboardData(text: csv));
    if (context.mounted) {
      ViroSnackBar.show(context, AppCopy.fees.csvCopied);
    }
  }

  Future<void> _markRemainingPaid(
    BuildContext context,
    WidgetRef ref,
    MemberFee fee,
    FeeSeason season,
  ) async {
    final remaining = fee.remainingCents(season);
    if (remaining <= 0) return;
    try {
      await ref.read(feeServiceProvider).validateOfflinePayment(
            clubId: clubId,
            seasonId: season.id,
            memberId: fee.memberId,
            offlineMethod: FeePaymentMethods.especes,
            amountCents: remaining,
            season: season,
            currentFee: fee,
          );
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.fees.offlinePaymentSaved);
      }
    } catch (e) {
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
      }
    }
  }

  Future<void> _collectPartial(
    BuildContext context,
    WidgetRef ref,
    MemberFee fee,
    FeeSeason season,
  ) async {
    final result = await showDialog<({String method, int amountCents})>(
      context: context,
      builder: (dCtx) => OfflinePaymentDialog(
        memberDisplayName: fee.memberDisplayName,
        remainingCents: fee.remainingCents(season),
      ),
    );
    if (!context.mounted || result == null) return;
    try {
      await ref.read(feeServiceProvider).validateOfflinePayment(
            clubId: clubId,
            seasonId: season.id,
            memberId: fee.memberId,
            offlineMethod: result.method,
            amountCents: result.amountCents,
            season: season,
            currentFee: fee,
          );
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.fees.offlinePaymentSaved);
      }
    } catch (e) {
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
      }
    }
  }

  /// Actions rapides terrain : payer / encaisser / assigner tarif.
  void _showFieldActions(
    BuildContext context,
    WidgetRef ref,
    MemberFee fee,
    FeeSeason season,
  ) {
    final needsTier = fee.tierId == null || fee.tierId!.isEmpty;
    final remaining = fee.remainingCents(season);
    final accent = accentColor ?? ViroColors.primary600;

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: Text(fee.memberDisplayName),
                subtitle: Text(
                  needsTier
                      ? AppCopy.fees.fieldNeedsTier
                      : remaining > 0
                          ? AppCopy.fees.remainingAmount(
                              formatFeeAmountCents(remaining),
                            )
                          : AppCopy.fees.fieldSettled,
                ),
              ),
              if (needsTier) ...[
                ListTile(
                  leading: ViroIcon(ViroIcons.payments, color: accent),
                  title: Text(AppCopy.fees.fieldAssignTierTitle),
                  subtitle: Text(AppCopy.fees.fieldAssignTierSubtitle),
                ),
                for (final tier in season.tiers)
                  ListTile(
                    title: Text(tier.label),
                    subtitle: Text(formatFeeAmountCents(tier.amountCents)),
                    onTap: () async {
                      Navigator.pop(ctx);
                      try {
                        await ref.read(feeServiceProvider).setMemberFeeTier(
                              clubId: clubId,
                              seasonId: season.id,
                              memberId: fee.memberId,
                              tierId: tier.tierId,
                              season: season,
                              currentFee: fee,
                            );
                        if (context.mounted) {
                          ViroSnackBar.show(context, AppCopy.fees.tiersAssigned);
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ViroSnackBar.show(
                            context,
                            AppCopy.common.errorWithDetails(e),
                          );
                        }
                      }
                    },
                  ),
              ] else if (remaining > 0) ...[
                ListTile(
                  leading: ViroIcon(ViroIcons.check, color: ViroColors.success),
                  title: Text(AppCopy.fees.fieldMarkPaidTitle),
                  subtitle: Text(
                    AppCopy.fees.fieldMarkPaidSubtitle(
                      formatFeeAmountCents(remaining),
                    ),
                  ),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await _markRemainingPaid(context, ref, fee, season);
                  },
                ),
                ListTile(
                  leading: ViroIcon(ViroIcons.payments, color: accent),
                  title: Text(AppCopy.fees.fieldPartialPayment),
                  subtitle: Text(AppCopy.fees.fieldPartialPaymentSubtitle),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await Future<void>.delayed(Duration.zero);
                    if (!context.mounted) return;
                    await _collectPartial(context, ref, fee, season);
                  },
                ),
              ],
              ListTile(
                leading: ViroIcon(ViroIcons.clock, color: accent),
                title: Text(AppCopy.fees.fieldPaymentHistory),
                onTap: () async {
                  Navigator.pop(ctx);
                  await Future<void>.delayed(Duration.zero);
                  if (!context.mounted) return;
                  await showFeePaymentHistorySheet(
                    context: context,
                    clubId: clubId,
                    seasonId: season.id,
                    memberId: fee.memberId,
                    memberDisplayName: fee.memberDisplayName,
                  );
                },
              ),
              const SizedBox(height: ViroSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final seasonAsync = ref.watch(activeSeasonProvider(clubId));
    final feesAsync = ref.watch(allMemberFeesProvider(clubId));
    final stats = ref.watch(feeStatsProvider(clubId));
    final members = ref.watch(clubMembersProvider(clubId)).value ?? [];
    final pendingAsMembers =
        (ref.watch(pendingTeamMembersProvider(clubId)).value ?? [])
            .map(pendingAsClubMember)
            .toList();

    return seasonAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stackTrace) => const ViroErrorState(),
      data: (season) {
        if (season == null) {
          return ViroEmptyState(
            message: AppCopy.fees.noActiveSeasonAdmin,
            icon: ViroIcons.payments,
            actionLabel:
                onOpenConfig != null ? AppCopy.fees.configureSeason : null,
            onAction: onOpenConfig,
          );
        }

        return feesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => const ViroErrorState(),
          data: (allFees) {
            final lists = _splitFees(allFees, season);
            final existingIds = allFees.map((f) => f.memberId).toSet();
            final pendingCount = pendingFeeInitCount(
              members: members,
              pendingAsMembers: pendingAsMembers,
              existingMemberIds: existingIds,
            );
            final hasAnyList =
                lists.unpaid.isNotEmpty || lists.upToDate.isNotEmpty;

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        AppCopy.fees.trackingStats(
                          paid: stats.paid,
                          total: stats.total,
                          paidPercent: stats.total > 0
                              ? (stats.paidPercent * 100).round()
                              : 0,
                          exempt: stats.exempt,
                          awaiting: stats.awaiting,
                        ),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: ViroColors.gray600,
                            ),
                      ),
                      const SizedBox(height: ViroSpacing.sm),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: searchCtrl,
                              decoration: InputDecoration(
                                hintText: AppCopy.fees.searchHint,
                                prefixIcon: ViroIcon(
                                  ViroIcons.search,
                                  color: ViroColors.gray600,
                                ),
                                isDense: true,
                              ),
                            ),
                          ),
                          IconButton(
                            icon: ViroIcon(ViroIcons.selectAll),
                            tooltip: AppCopy.fees.multiSelectTooltip,
                            onPressed: onToggleSelection,
                          ),
                          IconButton(
                            icon: ViroIcon(ViroIcons.copy),
                            tooltip: AppCopy.fees.exportCsvTooltip,
                            onPressed: () => _exportCsv(context, ref),
                          ),
                        ],
                      ),
                      if (season.tiers.isNotEmpty)
                        Align(
                          alignment: Alignment.centerLeft,
                          child: DropdownButton<String?>(
                            value: tierFilter,
                            hint: Text(AppCopy.fees.filterByCategory),
                            items: [
                              DropdownMenuItem(
                                value: null,
                                child: Text(AppCopy.fees.allCategories),
                              ),
                              for (final t in season.tiers)
                                DropdownMenuItem(
                                  value: t.tierId,
                                  child: Text(t.label),
                                ),
                            ],
                            onChanged: onTierFilterChanged,
                          ),
                        ),
                      if (pendingCount > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: ViroSpacing.sm),
                          child: OutlinedButton(
                            onPressed: () => _initialize(context, ref),
                            child: Text(
                              AppCopy.fees.addPendingMembers(pendingCount),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: ViroRefreshIndicator(
                    onRefresh: () async {
                      await Future.wait([
                        ref.refresh(activeSeasonProvider(clubId).future),
                        ref.refresh(allMemberFeesProvider(clubId).future),
                        ref.refresh(clubMembersProvider(clubId).future),
                        ref.refresh(pendingTeamMembersProvider(clubId).future),
                      ]);
                    },
                    child: !hasAnyList
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(
                                height: 240,
                                child: Center(
                                  child: Text(AppCopy.fees.noMembersToShow),
                                ),
                              ),
                            ],
                          )
                        : ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              if (lists.unpaid.isNotEmpty) ...[
                                _sectionTitle(
                                  context,
                                  AppCopy.fees
                                      .unpaidSection(lists.unpaid.length),
                                ),
                                for (final fee in lists.unpaid)
                                  _feeTile(
                                    context,
                                    ref,
                                    fee,
                                    season,
                                    actionable: _needsFieldActions(fee, season),
                                  ),
                              ],
                              if (lists.upToDate.isNotEmpty) ...[
                                _sectionTitle(
                                  context,
                                  AppCopy.fees
                                      .upToDateSection(lists.upToDate.length),
                                ),
                                for (final fee in lists.upToDate)
                                  _feeTile(
                                    context,
                                    ref,
                                    fee,
                                    season,
                                    actionable: false,
                                  ),
                              ],
                              const SizedBox(height: ViroSpacing.lg),
                            ],
                          ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
