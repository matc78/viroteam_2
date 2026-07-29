import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/utils/fee_iban_validator.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_bulk_action_sheet.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_members_tracking_tab.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_tier_editor.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class AdminFeesScreen extends ConsumerStatefulWidget {
  const AdminFeesScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<AdminFeesScreen> createState() => _AdminFeesScreenState();
}

class _AdminFeesScreenState extends ConsumerState<AdminFeesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _configTabKey = GlobalKey<_ConfigTabState>();
  bool _handlingTabGuard = false;
  String? _tierFilter;
  final _searchCtrl = TextEditingController();
  String _search = '';
  bool _selectionMode = false;
  final _selectedIds = <String>{};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _tabs.addListener(_onTabControllerChanged);
    _searchCtrl.addListener(() => setState(() => _search = _searchCtrl.text.trim().toLowerCase()));
  }

  @override
  void dispose() {
    _tabs.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  /// Tap sur [TabBar] : Flutter appelle `animateTo` avant tout `onTap`, donc on
  /// intercepte via [TabController.indexIsChanging] + [previousIndex].
  Future<void> _onTabControllerChanged() async {
    if (_handlingTabGuard) return;

    final leavingConfig =
        _tabs.previousIndex == 0 && _tabs.index != 0;
    if (!leavingConfig) return;

    if (_tabs.indexIsChanging) {
      await _guardLeaveConfigTab(_tabs.index);
      return;
    }

    // Balayage [TabBarView] : pas de indexIsChanging pendant le drag.
    await _guardLeaveConfigTab(_tabs.index);
  }

  Future<bool> _showUnsavedChangesDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Modifications non enregistrÃ©es'),
        content: const Text(
          'Des changements n\'ont pas Ã©tÃ© sauvegardÃ©s. '
          'Que souhaitez-vous faire ?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Continuer l\'Ã©dition'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Abandonner'),
          ),
        ],
      ),
    );
    return result == true;
  }

  /// Avant de quitter l'onglet Configuration (ou l'Ã©cran).
  Future<bool> _confirmLeaveConfigIfNeeded() async {
    final config = _configTabKey.currentState;
    if (config == null || !config.hasUnsavedChanges) return true;

    final discard = await _showUnsavedChangesDialog();
    if (!discard) return false;
    config.discardChanges();
    return true;
  }

  /// Bloque la sortie de Configuration tant que l'utilisateur n'a pas choisi.
  Future<void> _guardLeaveConfigTab(int targetIndex) async {
    if (targetIndex == 0) return;

    final config = _configTabKey.currentState;
    if (config == null || !config.hasUnsavedChanges) return;

    _handlingTabGuard = true;
    if (_tabs.index != 0) {
      _tabs.index = 0;
    }

    final discard = await _showUnsavedChangesDialog();
    if (!mounted) {
      _handlingTabGuard = false;
      return;
    }

    if (discard) {
      config.discardChanges();
      _tabs.animateTo(targetIndex);
      await Future<void>.delayed(_tabAnimationDuration);
    } else if (_tabs.index != 0) {
      _tabs.index = 0;
    }

    _handlingTabGuard = false;
  }

  Duration get _tabAnimationDuration => _tabs.animationDuration;

  @override
  Widget build(BuildContext context) {
    final member = ref.watch(clubMemberProvider(widget.clubId)).value;
    if (member != null && member.role != MemberRoles.admin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.replace(AppRoutes.clubMyFeePath(widget.clubId));
      });
      return const ViroScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final canLeave = await _confirmLeaveConfigIfNeeded();
        if (canLeave && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: ViroScaffold(
        appBar: ViroAppBar(
          title: const Text('Cotisations'),
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
            Material(
              color: ViroColors.scaffoldHighlight,
              child: TabBar(
                controller: _tabs,
                labelColor: ViroColors.primary800,
                tabs: const [
                  Tab(text: 'Saison'),
                  Tab(text: 'Membres'),
                ],
              ),
            ),
          Expanded(
            child: TabBarView(
        controller: _tabs,
        children: [
          _ConfigTab(
            key: _configTabKey,
            clubId: widget.clubId,
            saving: _saving,
            onSaving: (v) => setState(() => _saving = v),
          ),
          FeeMembersTrackingTab(
            clubId: widget.clubId,
            tierFilter: _tierFilter,
            onTierFilterChanged: (v) => setState(() => _tierFilter = v),
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
            ],
          ),
          ),
        ],
      ),
        floatingActionButton: _selectionMode && _selectedIds.isNotEmpty
            ? FloatingActionButton.extended(
                onPressed: _openBulkActions,
                icon: ViroIcon(ViroIcons.edit, color: ViroColors.white),
                label: Text('${_selectedIds.length} sÃ©lectionnÃ©(s)'),
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
      if (mounted) ViroSnackBar.show(context, 'Mise Ã  jour effectuÃ©e');
    } catch (e) {
      if (mounted) ViroSnackBar.show(context, 'Erreur : $e');
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
      if (mounted) ViroSnackBar.show(context, 'CatÃ©gories assignÃ©es');
    } catch (e) {
      if (mounted) ViroSnackBar.show(context, 'Erreur : $e');
    }
  }
}

/// InstantanÃ© du formulaire configuration pour dÃ©tecter les modifications.
class _ConfigFormSnapshot {
  const _ConfigFormSnapshot({
    required this.seasonLabel,
    required this.paymentInstructions,
    required this.iban,
    required this.paymentMethods,
    required this.paymentDeadlineAt,
    required this.tiers,
  });

  final String seasonLabel;
  final String paymentInstructions;
  final String? iban;
  final List<String> paymentMethods;
  final DateTime? paymentDeadlineAt;
  final List<FeeTier> tiers;

  factory _ConfigFormSnapshot.fromForm({
    required String seasonLabel,
    required String paymentInstructions,
    required String? iban,
    required List<String> paymentMethods,
    required DateTime? paymentDeadlineAt,
    required List<FeeTier> tiers,
  }) {
    return _ConfigFormSnapshot(
      seasonLabel: seasonLabel,
      paymentInstructions: paymentInstructions,
      iban: iban == null || iban.trim().isEmpty
          ? null
          : normalizeIban(iban.trim()),
      paymentMethods: List<String>.from(paymentMethods)..sort(),
      paymentDeadlineAt: paymentDeadlineAt,
      tiers: tiers
          .map((t) => FeeTier(tierId: t.tierId, label: t.label.trim(), amountCents: t.amountCents))
          .toList(),
    );
  }

  bool equals(_ConfigFormSnapshot other) {
    if (seasonLabel != other.seasonLabel) return false;
    if (paymentInstructions != other.paymentInstructions) return false;
    if (iban != other.iban) return false;
    if (paymentDeadlineAt?.year != other.paymentDeadlineAt?.year ||
        paymentDeadlineAt?.month != other.paymentDeadlineAt?.month ||
        paymentDeadlineAt?.day != other.paymentDeadlineAt?.day) {
      return false;
    }
    final methodsA = paymentMethods.toSet();
    final methodsB = other.paymentMethods.toSet();
    if (methodsA.length != methodsB.length) return false;
    for (final m in methodsA) {
      if (!methodsB.contains(m)) return false;
    }
    if (tiers.length != other.tiers.length) return false;
    for (var i = 0; i < tiers.length; i++) {
      final a = tiers[i];
      final b = other.tiers[i];
      if (a.tierId != b.tierId ||
          a.label != b.label ||
          a.amountCents != b.amountCents) {
        return false;
      }
    }
    return true;
  }
}

class _ConfigTab extends ConsumerStatefulWidget {
  const _ConfigTab({
    super.key,
    required this.clubId,
    required this.saving,
    required this.onSaving,
  });

  final String clubId;
  final bool saving;
  final ValueChanged<bool> onSaving;

  @override
  ConsumerState<_ConfigTab> createState() => _ConfigTabState();
}

class _ConfigTabState extends ConsumerState<_ConfigTab> {
  final _seasonLabelCtrl = TextEditingController();
  final _instructionsCtrl = TextEditingController();
  final _ibanCtrl = TextEditingController();
  List<FeeTier> _tiers = [];
  List<String> _paymentMethods = [];
  DateTime? _deadline;
  bool _initialized = false;
  bool _listenersAttached = false;
  _ConfigFormSnapshot? _savedSnapshot;

  bool get hasUnsavedChanges {
    final snap = _savedSnapshot;
    if (snap == null) return false;
    return !snap.equals(_currentSnapshot());
  }

  _ConfigFormSnapshot _currentSnapshot() => _ConfigFormSnapshot.fromForm(
        seasonLabel: _seasonLabelCtrl.text.trim(),
        paymentInstructions: _instructionsCtrl.text.trim(),
        iban: _ibanCtrl.text.trim().isEmpty ? null : _ibanCtrl.text,
        paymentMethods: _paymentMethods,
        paymentDeadlineAt: _deadline,
        tiers: _tiers,
      );

  void _markDirty() {
    if (mounted) setState(() {});
  }

  void _attachListeners() {
    if (_listenersAttached) return;
    _listenersAttached = true;
    _seasonLabelCtrl.addListener(_markDirty);
    _instructionsCtrl.addListener(_markDirty);
    _ibanCtrl.addListener(_markDirty);
  }

  @override
  void dispose() {
    _seasonLabelCtrl.dispose();
    _instructionsCtrl.dispose();
    _ibanCtrl.dispose();
    super.dispose();
  }

  void _loadFromSeason(FeeSeason season) {
    if (_initialized) return;
    _initialized = true;
    _seasonLabelCtrl.text = season.seasonLabel;
    _instructionsCtrl.text = season.paymentInstructions;
    _ibanCtrl.text = season.iban ?? '';
    _tiers = List.from(season.tiers);
    _paymentMethods = List.from(season.paymentMethods);
    _deadline = season.paymentDeadlineAt;
    _attachListeners();
    _savedSnapshot = _currentSnapshot();
  }

  void discardChanges() {
    setState(() {
      _initialized = false;
      _savedSnapshot = null;
    });
  }

  void _commitSnapshot() {
    _savedSnapshot = _currentSnapshot();
    _markDirty();
  }

  Future<void> _createSeason() async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;
    widget.onSaving(true);
    try {
      final season = FeeSeason(
        id: '',
        seasonLabel: '2025-2026',
        isActive: true,
        tiers: [
          FeeTier(
            tierId: 'tier_default',
            label: 'Standard',
            amountCents: 0,
          ),
        ],
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
        createdBy: uid,
      );
      await ref.read(feeServiceProvider).createSeason(
            clubId: widget.clubId,
            season: season,
          );
      if (mounted) ViroSnackBar.show(context, 'Saison crÃ©Ã©e');
      setState(() => _initialized = false);
    } catch (e) {
      if (mounted) ViroSnackBar.show(context, 'Erreur : $e');
    } finally {
      widget.onSaving(false);
    }
  }

  Future<bool> _onDeleteTier(FeeTier tier) async {
    final season = ref.read(activeSeasonProvider(widget.clubId)).value;
    if (season == null) return true;
    final count = await ref.read(feeServiceProvider).countMemberFeesWithTier(
          clubId: widget.clubId,
          seasonId: season.id,
          tierId: tier.tierId,
        );
    if (count > 0 && mounted) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Supprimer cette catÃ©gorie ?'),
          content: Text(
            'Ce palier est assignÃ© Ã  $count membre${count > 1 ? 's' : ''}. '
            'Confirmer la suppression ?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Supprimer'),
            ),
          ],
        ),
      );
      return confirm == true;
    }
    return true;
  }

  Future<void> _save(FeeSeason season) async {
    if (_tiers.isEmpty) {
      ViroSnackBar.show(context, 'Ajoutez au moins une catÃ©gorie tarifaire');
      return;
    }
    for (final t in _tiers) {
      if (t.label.trim().isEmpty || t.amountCents <= 0) {
        ViroSnackBar.show(context, 'Chaque catÃ©gorie doit avoir un libellÃ© et un montant > 0');
        return;
      }
    }
    if (!isValidIbanFormat(_ibanCtrl.text)) {
      ViroSnackBar.show(context, 'Format IBAN invalide');
      return;
    }

    widget.onSaving(true);
    try {
      final updated = FeeSeason(
        id: season.id,
        seasonLabel: _seasonLabelCtrl.text.trim(),
        isActive: season.isActive,
        paymentInstructions: _instructionsCtrl.text.trim(),
        paymentMethods: _paymentMethods,
        iban: _ibanCtrl.text.trim().isEmpty ? null : normalizeIban(_ibanCtrl.text),
        tiers: _tiers,
        paymentDeadlineAt: _deadline,
        createdAt: season.createdAt,
        updatedAt: season.updatedAt,
        createdBy: season.createdBy,
      );
      await ref.read(feeServiceProvider).updateSeason(
            clubId: widget.clubId,
            season: updated,
          );
      if (mounted) {
        _commitSnapshot();
        ViroSnackBar.show(context, 'EnregistrÃ©');
      }
    } catch (e) {
      if (mounted) ViroSnackBar.show(context, 'Erreur : $e');
    } finally {
      widget.onSaving(false);
    }
  }

  Future<void> _closeSeason(FeeSeason season) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ClÃ´turer la saison ?'),
        content: const Text(
          'Les joueurs ne verront plus cette saison. Les donnÃ©es restent accessibles.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('ClÃ´turer'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    await ref.read(feeServiceProvider).closeSeason(
          clubId: widget.clubId,
          seasonId: season.id,
        );
    if (mounted) ViroSnackBar.show(context, 'Saison clÃ´turÃ©e');
    setState(() => _initialized = false);
  }

  @override
  Widget build(BuildContext context) {
    final seasonAsync = ref.watch(activeSeasonProvider(widget.clubId));

    return seasonAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => const ViroErrorState(),
      data: (season) {
        if (season == null) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(ViroSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Aucune saison de cotisation active',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: ViroSpacing.lg),
                  ViroPrimaryButton(
                    label: 'CrÃ©er la saison',
                    onPressed: widget.saving ? null : _createSeason,
                  ),
                ],
              ),
            ),
          );
        }

        _loadFromSeason(season);

        return ListView(
          padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
          children: [
            Text(
              'Paramétrez la saison et les montants, puis suivez les paiements dans l''onglet Membres.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: ViroColors.gray600,
                  ),
            ),
            const SizedBox(height: ViroSpacing.md),
            TextField(
              controller: _seasonLabelCtrl,
              decoration: const InputDecoration(labelText: 'Libellé saison'),
            ),
            const SizedBox(height: ViroSpacing.md),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Date limite de paiement'),
              subtitle: _deadline == null
                  ? const Text('Non définie')
                  : Text(DateFormat.yMMMMd('fr_FR').format(_deadline!)),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_deadline != null)
                    IconButton(
                      icon: ViroIcon(ViroIcons.close, size: 18),
                      onPressed: () => setState(() => _deadline = null),
                    ),
                  IconButton(
                    icon: ViroIcon(ViroIcons.calendar),
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _deadline ?? DateTime.now(),
                        firstDate: DateTime.now(),
                        lastDate:
                            DateTime.now().add(const Duration(days: 365 * 2)),
                      );
                      if (picked != null) setState(() => _deadline = picked);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
            Text(
              'Grille tarifaire',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            FeeTierEditor(
              tiers: _tiers,
              onChanged: (t) => setState(() => _tiers = t),
              onDeleteTier: _onDeleteTier,
            ),
            const SizedBox(height: ViroSpacing.md),
            Card(
              color: ViroColors.primary50,
              elevation: 0,
              child: Padding(
                padding: const EdgeInsets.all(ViroSpacing.md),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ViroIcon(ViroIcons.payments, color: ViroColors.primary600),
                    const SizedBox(width: ViroSpacing.sm),
                    Expanded(
                      child: Text(
                        'Paiement en ligne dans l''app : bientôt disponible. '
                        'En attendant, renseignez un paiement hors app ci-dessous si besoin.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: ViroColors.primary800,
                              height: 1.4,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text(
                'Paiement hors app (optionnel)',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              subtitle: const Text('IBAN, consignes, moyens acceptés'),
              children: [
                TextField(
                  controller: _instructionsCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Consignes de paiement',
                  ),
                  maxLines: 4,
                ),
                const SizedBox(height: ViroSpacing.md),
                TextField(
                  controller: _ibanCtrl,
                  decoration:
                      const InputDecoration(labelText: 'IBAN (optionnel)'),
                ),
                const SizedBox(height: ViroSpacing.md),
                Text(
                  'Moyens de paiement',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                Wrap(
                  spacing: ViroSpacing.sm,
                  children: FeePaymentMethods.all.map((method) {
                    final selected = _paymentMethods.contains(method);
                    return FilterChip(
                      label: Text(
                        FeePaymentMethods.label(method),
                        style: TextStyle(
                          color: selected
                              ? ViroColors.white
                              : ViroColors.primary800,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      selected: selected,
                      showCheckmark: false,
                      selectedColor: ViroColors.primary600,
                      backgroundColor: ViroColors.gray50,
                      side: BorderSide(
                        color: selected
                            ? ViroColors.primary600
                            : ViroColors.gray200,
                      ),
                      onSelected: (v) {
                        setState(() {
                          if (v) {
                            _paymentMethods = [..._paymentMethods, method];
                          } else {
                            _paymentMethods = _paymentMethods
                                .where((m) => m != method)
                                .toList();
                          }
                        });
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: ViroSpacing.md),
              ],
            ),
            const SizedBox(height: ViroSpacing.lg),
            if (hasUnsavedChanges)
              ViroPrimaryButton(
                label: widget.saving ? 'Enregistrement…' : 'Sauvegarder',
                onPressed: widget.saving ? null : () => _save(season),
              ),
            if (hasUnsavedChanges) const SizedBox(height: ViroSpacing.sm),
            OutlinedButton(
              onPressed: () => _closeSeason(season),
              child: const Text('Clôturer la saison'),
            ),
          ],
        );
      },
    );
  }
}

