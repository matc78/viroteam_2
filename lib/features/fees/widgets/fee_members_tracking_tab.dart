import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/widgets/member_fee_list_tile.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';

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
    required this.paid,
    required this.exempt,
  });

  final List<MemberFee> unpaid;
  final List<MemberFee> paid;
  final List<MemberFee> exempt;
}

/// Onglet suivi des cotisations membres (admin).
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
    final paid = <MemberFee>[];
    final exempt = <MemberFee>[];

    for (final f in filtered) {
      switch (f.displayStatus(season.paymentDeadlineAt)) {
        case MemberFeeDisplayStatus.paye:
          paid.add(f);
        case MemberFeeDisplayStatus.exonere:
          exempt.add(f);
        case MemberFeeDisplayStatus.aPayer:
        case MemberFeeDisplayStatus.enRetard:
          unpaid.add(f);
      }
    }

    _sortByName(unpaid);
    _sortByName(paid);
    _sortByName(exempt);
    return FeeTrackingLists(unpaid: unpaid, paid: paid, exempt: exempt);
  }

  Widget _sectionTitle(BuildContext context, String title) {
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
              color: ViroColors.primary800,
            ),
      ),
    );
  }

  Widget _feeTile(
    BuildContext context,
    WidgetRef ref,
    MemberFee fee,
    FeeSeason season,
  ) {
    final selected = selectedIds.contains(fee.memberId);
    return MemberFeeListTile(
      fee: fee,
      season: season,
      selected: selected,
      selectionMode: selectionMode,
      onTap: () {
        if (selectionMode) {
          onSelect(fee.memberId, !selected);
        } else {
          _showMemberMenu(context, ref, fee, season);
        }
      },
      onLongPress: () {
        if (!selectionMode) onToggleSelection();
        onSelect(fee.memberId, true);
      },
      onMenu: () => _showMemberMenu(context, ref, fee, season),
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
        ViroSnackBar.show(context, 'Tous les membres ont dÃ©jÃ  une fiche.');
      }
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ajouter au suivi ?'),
        content: Text(
          'CrÃ©er $count fiche${count > 1 ? 's' : ''} de cotisation '
          'pour les membres pas encore listÃ©s.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('CrÃ©er'),
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
        ViroSnackBar.show(context, '$created fiche${created > 1 ? 's' : ''} crÃ©Ã©e${created > 1 ? 's' : ''}');
      }
    } catch (e) {
      if (context.mounted) ViroSnackBar.show(context, 'Erreur : $e');
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
      ViroSnackBar.show(context, 'CSV copiÃ© dans le presse-papiers');
    }
  }

  void _showMemberMenu(
    BuildContext context,
    WidgetRef ref,
    MemberFee fee,
    FeeSeason season,
  ) {
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
                subtitle:
                    Text(fee.displayStatus(season.paymentDeadlineAt).label),
              ),
            ListTile(
              leading: const Icon(Icons.check),
              title: const Text('Marquer payÃ©'),
              onTap: () async {
                Navigator.pop(ctx);
                await ref.read(feeServiceProvider).setMemberFeeStatus(
                      clubId: clubId,
                      seasonId: season.id,
                      memberId: fee.memberId,
                      status: MemberFeeStatus.paye,
                    );
              },
            ),
            ListTile(
              leading: const Icon(Icons.schedule),
              title: const Text('Marquer Ã  payer'),
              onTap: () async {
                Navigator.pop(ctx);
                await ref.read(feeServiceProvider).setMemberFeeStatus(
                      clubId: clubId,
                      seasonId: season.id,
                      memberId: fee.memberId,
                      status: MemberFeeStatus.aPayer,
                    );
              },
            ),
            ListTile(
              leading: const Icon(Icons.block),
              title: const Text('Marquer exonÃ©rÃ©'),
              onTap: () async {
                Navigator.pop(ctx);
                await ref.read(feeServiceProvider).setMemberFeeStatus(
                      clubId: clubId,
                      seasonId: season.id,
                      memberId: fee.memberId,
                      status: MemberFeeStatus.exonere,
                    );
              },
            ),
            if (season.tiers.isNotEmpty) ...[
              const Divider(),
              for (final tier in season.tiers)
                ListTile(
                  title: Text('CatÃ©gorie : ${tier.label}'),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await ref.read(feeServiceProvider).setMemberFeeTier(
                          clubId: clubId,
                          seasonId: season.id,
                          memberId: fee.memberId,
                          tierId: tier.tierId,
                        );
                  },
                ),
            ],
            ListTile(
              leading: const Icon(Icons.note_alt_outlined),
              title: const Text('Note admin'),
              onTap: () async {
                Navigator.pop(ctx);
                await Future<void>.delayed(Duration.zero);
                if (!context.mounted) return;
                final saved = await showDialog<String?>(
                  context: context,
                  builder: (dCtx) => MemberFeeNoteDialog(
                    initialText: fee.notesAdmin ?? '',
                  ),
                );
                if (!context.mounted || saved == null) return;
                await ref.read(feeServiceProvider).setMemberFeeNote(
                      clubId: clubId,
                      seasonId: season.id,
                      memberId: fee.memberId,
                      note: saved,
                    );
                if (context.mounted) {
                  ViroSnackBar.show(context, 'Note enregistrÃ©e');
                }
              },
            ),
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
    final pendingAsMembers = (ref.watch(pendingTeamMembersProvider(clubId)).value ??
            [])
        .map(pendingAsClubMember)
        .toList();

    return seasonAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => const ViroErrorState(),
      data: (season) {
        if (season == null) {
          return const Center(
            child: Text('CrÃ©ez d\'abord une saison dans l\'onglet Configuration'),
          );
        }

        return feesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => const ViroErrorState(),
          data: (allFees) {
            final lists = _splitFees(allFees, season);
            final existingIds = allFees.map((f) => f.memberId).toSet();
            final pendingCount = pendingFeeInitCount(
              members: members,
              pendingAsMembers: pendingAsMembers,
              existingMemberIds: existingIds,
            );
            final hasAnyList = lists.unpaid.isNotEmpty ||
                lists.paid.isNotEmpty ||
                lists.exempt.isNotEmpty;

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        '${stats.paid} / ${stats.total} ont payÃ© '
                        '(${stats.total > 0 ? (stats.paidPercent * 100).round() : 0} %) Â· '
                        '${stats.exempt} exonÃ©rÃ©${stats.exempt > 1 ? 's' : ''} Â· '
                        '${stats.awaiting} en attente',
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
                              decoration: const InputDecoration(
                                hintText: 'Rechercherâ€¦',
                                prefixIcon: Icon(Icons.search),
                                isDense: true,
                              ),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.select_all),
                            tooltip: 'SÃ©lection multiple',
                            onPressed: onToggleSelection,
                          ),
                          IconButton(
                            icon: ViroIcon(ViroIcons.copy),
                            tooltip: 'Exporter CSV',
                            onPressed: () => _exportCsv(context, ref),
                          ),
                        ],
                      ),
                      if (season.tiers.isNotEmpty)
                        Align(
                          alignment: Alignment.centerLeft,
                          child: DropdownButton<String?>(
                            value: tierFilter,
                            hint: const Text('Filtrer par catÃ©gorie'),
                            items: [
                              const DropdownMenuItem(
                                value: null,
                                child: Text('Toutes les catÃ©gories'),
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
                              'Ajouter $pendingCount membre'
                              '${pendingCount > 1 ? 's' : ''}',
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: !hasAnyList
                      ? const Center(child: Text('Aucun membre Ã  afficher'))
                      : ListView(
                          children: [
                            if (lists.unpaid.isNotEmpty) ...[
                              _sectionTitle(
                                context,
                                'En attente (${lists.unpaid.length})',
                              ),
                              for (final fee in lists.unpaid)
                                _feeTile(context, ref, fee, season),
                            ],
                            if (lists.paid.isNotEmpty) ...[
                              _sectionTitle(
                                context,
                                'PayÃ©s (${lists.paid.length})',
                              ),
                              for (final fee in lists.paid)
                                _feeTile(context, ref, fee, season),
                            ],
                            if (lists.exempt.isNotEmpty) ...[
                              _sectionTitle(
                                context,
                                'ExonÃ©rÃ©s (${lists.exempt.length})',
                              ),
                              for (final fee in lists.exempt)
                                _feeTile(context, ref, fee, season),
                            ],
                            const SizedBox(height: ViroSpacing.lg),
                          ],
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

/// Dialogue note admin â€” le [TextEditingController] vit dans le State du dialogue.
class MemberFeeNoteDialog extends StatefulWidget {
  const MemberFeeNoteDialog({super.key, required this.initialText});

  final String initialText;

  @override
  State<MemberFeeNoteDialog> createState() => MemberFeeNoteDialogState();
}

class MemberFeeNoteDialogState extends State<MemberFeeNoteDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialText);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Note admin'),
      content: TextField(
        controller: _controller,
        maxLines: 3,
        autofocus: true,
        decoration: const InputDecoration(hintText: 'Note privÃ©e'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Annuler'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, _controller.text),
          child: const Text('Enregistrer'),
        ),
      ],
    );
  }
}
