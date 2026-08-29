import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_bulk_action_sheet.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_config_tab.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_members_tracking_tab.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Admin cotisations : configuration saison + suivi membres.
class AdminFeesScreen extends ConsumerStatefulWidget {
  const AdminFeesScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<AdminFeesScreen> createState() => _AdminFeesScreenState();
}

class _AdminFeesScreenState extends ConsumerState<AdminFeesScreen> {
  /// `config` | `tracking`
  String _section = 'config';
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

  @override
  Widget build(BuildContext context) {
    final member = ref.watch(clubMemberProvider(widget.clubId)).value;
    final accent = ref.watch(clubManagementAccentProvider(widget.clubId));
    final memberAccent = ref.watch(clubMemberAccentProvider(widget.clubId));

    if (member != null && member.role != MemberRoles.admin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.replace(AppRoutes.clubMyFeePath(widget.clubId));
      });
      return const ViroScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
        appBar: ViroAppBar(
          title: const Text('Cotisations'),
          actions: [
            if (_section == 'tracking' && _selectionMode)
              TextButton(
                onPressed: () => setState(() {
                  _selectionMode = false;
                  _selectedIds.clear();
                }),
                child: const Text('Annuler'),
              ),
          ],
        ),
        body: Column(
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
                    label: 'Configuration',
                    selected: _section == 'config',
                    accent: accent,
                    onSelected: (_) => _openConfigTab(),
                  ),
                  const SizedBox(width: ViroSpacing.xs),
                  _sectionChip(
                    label: 'Suivi',
                    selected: _section == 'tracking',
                    accent: accent,
                    onSelected: (_) => _openTrackingTab(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _section == 'config'
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
        floatingActionButton: _section == 'tracking' &&
                _selectionMode &&
                _selectedIds.isNotEmpty
            ? FloatingActionButton.extended(
                onPressed: _openBulkActions,
                icon: ViroIcon(ViroIcons.edit, color: Colors.white),
                label: Text('${_selectedIds.length} sélectionné(s)'),
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
      onMarkPaid: () => _bulkStatus(MemberFeeStatus.paye, season.id),
      onMarkExempt: () => _bulkStatus(MemberFeeStatus.exonere, season.id),
      onMarkUnpaid: () => _bulkStatus(MemberFeeStatus.aPayer, season.id),
      onAssignTier: (tierId) => _bulkTier(tierId, season.id),
    );
  }

  Future<void> _bulkStatus(MemberFeeStatus status, String seasonId) async {
    try {
      await ref.read(feeServiceProvider).bulkSetStatus(
            clubId: widget.clubId,
            seasonId: seasonId,
            memberIds: _selectedIds.toList(),
            status: status,
          );
      setState(() {
        _selectionMode = false;
        _selectedIds.clear();
      });
      if (mounted) ViroSnackBar.show(context, 'Mise à jour effectuée');
    } catch (error) {
      if (mounted) ViroSnackBar.show(context, 'Erreur : $error');
    }
  }

  Future<void> _bulkTier(String tierId, String seasonId) async {
    try {
      await ref.read(feeServiceProvider).bulkSetTier(
            clubId: widget.clubId,
            seasonId: seasonId,
            memberIds: _selectedIds.toList(),
            tierId: tierId,
          );
      setState(() {
        _selectionMode = false;
        _selectedIds.clear();
      });
      if (mounted) ViroSnackBar.show(context, 'Catégories assignées');
    } catch (error) {
      if (mounted) ViroSnackBar.show(context, 'Erreur : $error');
    }
  }
}
