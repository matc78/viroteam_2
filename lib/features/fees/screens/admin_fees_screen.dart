import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_bulk_action_sheet.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_members_tracking_tab.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/portal_admin_banner.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Vue opérationnelle admin : suivi des cotisations membres (config → portail).
class AdminFeesScreen extends ConsumerStatefulWidget {
  const AdminFeesScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<AdminFeesScreen> createState() => _AdminFeesScreenState();
}

class _AdminFeesScreenState extends ConsumerState<AdminFeesScreen> {
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
        title: const Text('Suivi cotisations'),
        actions: [
          if (_selectionMode)
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
        children: [
          PortalAdminBanner(
            portalUrl: portalFeesUrl(clubId: widget.clubId),
            accentColor: accent,
            message:
                'Configuration de la saison, paliers, IBAN et HelloAsso : '
                'espace club sur le web.',
          ),
          Expanded(
            child: FeeMembersTrackingTab(
              clubId: widget.clubId,
              accentColor: accent,
              tierFilter: _tierFilter,
              onTierFilterChanged: (value) => setState(() => _tierFilter = value),
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
            ),
          ),
        ],
      ),
      floatingActionButton: _selectionMode && _selectedIds.isNotEmpty
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
