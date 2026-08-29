import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/equipment/providers/equipment_providers.dart';
import 'package:viro_team_v2/features/equipment/widgets/equipment_form_sheet.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club_equipment.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_floating_icon_button.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/equipment_list_tile.dart';

/// Inventaire équipements club (aligné portail `/equipment`).
class ClubEquipmentScreen extends ConsumerStatefulWidget {
  const ClubEquipmentScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubEquipmentScreen> createState() =>
      _ClubEquipmentScreenState();
}

class _ClubEquipmentScreenState extends ConsumerState<ClubEquipmentScreen> {
  final _searchController = TextEditingController();
  String _search = '';
  String _categoryFilter = 'all';
  String _conditionFilter = 'all';
  bool _busy = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<ClubEquipmentItem> _filterItems(List<ClubEquipmentItem> items) {
    final query = _search.trim().toLowerCase();
    return items.where((item) {
      if (_categoryFilter != 'all' && item.category != _categoryFilter) {
        return false;
      }
      if (_conditionFilter != 'all' && item.condition != _conditionFilter) {
        return false;
      }
      if (query.isEmpty) return true;
      final haystack = [
        item.name,
        item.category,
        item.location,
        item.notes,
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
  }

  Set<String> _categories(List<ClubEquipmentItem> items) {
    return items.map((item) => item.category).where((c) => c.isNotEmpty).toSet();
  }

  Future<void> _openForm({ClubEquipmentItem? existing}) async {
    final teams = ref.read(clubTeamsProvider(widget.clubId)).value ?? [];
    final club = ref.read(clubProvider(widget.clubId)).value;
    final memberAccent = ref.read(clubMemberAccentProvider(widget.clubId));
    final managementAccent = ref.read(clubManagementAccentProvider(widget.clubId));
    final input = await showEquipmentFormSheet(
      context,
      existing: existing,
      teams: teams,
      clubSport: club?.sport ?? '',
      memberAccent: memberAccent,
      managementAccent: managementAccent,
    );
    if (input == null || !mounted) return;

    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;

    setState(() => _busy = true);
    try {
      final service = ref.read(equipmentServiceProvider);
      if (existing == null) {
        await service.createItem(
          clubId: widget.clubId,
          updatedByUid: uid,
          input: input,
        );
        if (mounted) ViroSnackBar.show(context, 'Équipement créé');
      } else {
        await service.updateItem(
          clubId: widget.clubId,
          itemId: existing.id,
          updatedByUid: uid,
          input: input,
        );
        if (mounted) ViroSnackBar.show(context, 'Équipement mis à jour');
      }
      ref.invalidate(clubEquipmentProvider(widget.clubId));
    } catch (error) {
      if (mounted) ViroSnackBar.show(context, error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deleteItem(ClubEquipmentItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer cet équipement ?'),
        content: Text('« ${item.name} » sera retiré de l’inventaire.'),
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
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    try {
      await ref.read(equipmentServiceProvider).deleteItem(
            clubId: widget.clubId,
            itemId: item.id,
          );
      ref.invalidate(clubEquipmentProvider(widget.clubId));
      if (mounted) ViroSnackBar.show(context, 'Équipement supprimé');
    } catch (error) {
      if (mounted) ViroSnackBar.show(context, error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _filterChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    required Color accent,
  }) {
    return FilterChip(
      label: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: selected ? ViroColors.white : accent,
              fontWeight: FontWeight.w600,
            ),
      ),
      selected: selected,
      onSelected: (_) => onTap(),
      showCheckmark: false,
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      selectedColor: accent,
      backgroundColor: ViroColors.gray50,
      side: BorderSide(color: selected ? accent : ViroColors.gray200),
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.sm,
        vertical: ViroSpacing.xs,
      ),
    );
  }

  List<Widget> _filterChipRow(List<Widget> chips) {
    if (chips.isEmpty) return chips;
    final spaced = <Widget>[chips.first];
    for (var index = 1; index < chips.length; index++) {
      spaced.add(const SizedBox(width: ViroSpacing.sm));
      spaced.add(chips[index]);
    }
    return spaced;
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final member = ref.watch(clubMemberProvider(clubId)).value;
    final memberAccent = ref.watch(clubMemberAccentProvider(clubId));
    final managementAccent = ref.watch(clubManagementAccentProvider(clubId));
    final itemsAsync = ref.watch(clubEquipmentProvider(clubId));
    final teamsAsync = ref.watch(clubTeamsProvider(clubId));

    if (member != null && member.role != MemberRoles.admin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.pop();
      });
      return const ViroScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final teamNames = {
      for (final team in teamsAsync.value ?? []) team.id: team.name,
    };

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
        appBar: ViroAppBar(
          leading: IconButton(
            icon: ViroIcon(ViroIcons.chevronLeft),
            onPressed: () => context.pop(),
          ),
          title: const Text('Équipements'),
        ),
        floatingActionButton: _busy
            ? null
            : ViroFloatingActionButton(
                icon: ViroIcons.add,
                onPressed: () => _openForm(),
              ),
        body: itemsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => const ViroErrorState(),
          data: (items) {
            final categories = _categories(items).toList()..sort();
            final filtered = _filterItems(items);

            return ViroRefreshIndicator(
              onRefresh: () async {
                ref.invalidate(clubEquipmentProvider(clubId));
                await ref.read(clubEquipmentProvider(clubId).future);
              },
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.md,
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.sm,
                      ),
                      child: Text(
                        'Stock simple du club : quantités, état, emplacement.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: ViroColors.gray600,
                            ),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: ViroSpacing.screenHorizontal,
                      ),
                      child: TextField(
                        controller: _searchController,
                        decoration: InputDecoration(
                          hintText: 'Rechercher…',
                          prefixIcon: ViroIcon(ViroIcons.search),
                        ),
                        onChanged: (value) =>
                            setState(() => _search = value),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.sm,
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.xs,
                      ),
                      child: Row(
                        children: _filterChipRow([
                          _filterChip(
                            label: 'Toutes catégories',
                            selected: _categoryFilter == 'all',
                            accent: managementAccent,
                            onTap: () =>
                                setState(() => _categoryFilter = 'all'),
                          ),
                          ...categories.map(
                            (category) => _filterChip(
                              label: category,
                              selected: _categoryFilter == category,
                              accent: managementAccent,
                              onTap: () => setState(
                                () => _categoryFilter = category,
                              ),
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.xs,
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.sm,
                      ),
                      child: Row(
                        children: _filterChipRow([
                          _filterChip(
                            label: 'Tous états',
                            selected: _conditionFilter == 'all',
                            accent: managementAccent,
                            onTap: () =>
                                setState(() => _conditionFilter = 'all'),
                          ),
                          _filterChip(
                            label: 'OK',
                            selected:
                                _conditionFilter == EquipmentConditions.ok,
                            accent: managementAccent,
                            onTap: () => setState(
                              () => _conditionFilter = EquipmentConditions.ok,
                            ),
                          ),
                          _filterChip(
                            label: 'Usé',
                            selected:
                                _conditionFilter == EquipmentConditions.use,
                            accent: managementAccent,
                            onTap: () => setState(
                              () => _conditionFilter = EquipmentConditions.use,
                            ),
                          ),
                          _filterChip(
                            label: 'HS',
                            selected:
                                _conditionFilter == EquipmentConditions.hs,
                            accent: managementAccent,
                            onTap: () => setState(
                              () => _conditionFilter = EquipmentConditions.hs,
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ),
                  if (filtered.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Text(
                          items.isEmpty
                              ? 'Aucun équipement pour le moment'
                              : 'Aucun résultat',
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: ViroColors.gray600),
                        ),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(
                        ViroSpacing.screenHorizontal,
                        0,
                        ViroSpacing.screenHorizontal,
                        ViroSpacing.xl,
                      ),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final item = filtered[index];
                            return EquipmentListTile(
                              item: item,
                              accentColor: managementAccent,
                              teamLabel: item.assignedTeamId != null
                                  ? teamNames[item.assignedTeamId]
                                  : null,
                              onTap: _busy
                                  ? null
                                  : () => _openForm(existing: item),
                              onDelete: _busy
                                  ? null
                                  : () => _deleteItem(item),
                            );
                          },
                          childCount: filtered.length,
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
