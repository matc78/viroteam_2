import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/equipment/utils/equipment_categories.dart';
import 'package:viro_team_v2/models/club_equipment.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Résultat du formulaire inventaire.
typedef EquipmentFormResult = ClubEquipmentInput;

/// Ouvre le formulaire création / édition d’un équipement.
Future<EquipmentFormResult?> showEquipmentFormSheet(
  BuildContext context, {
  ClubEquipmentItem? existing,
  required List<ClubTeam> teams,
  required String clubSport,
  required Color memberAccent,
  required Color managementAccent,
}) {
  return showModalBottomSheet<EquipmentFormResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: ViroColors.surfaceCard,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(ViroSpacing.cardRadius),
      ),
    ),
    builder: (sheetContext) => ClubAccentTheme(
      accentColor: memberAccent,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: _EquipmentFormSheet(
          existing: existing,
          teams: teams,
          clubSport: clubSport,
          managementAccent: managementAccent,
        ),
      ),
    ),
  );
}

class _EquipmentFormSheet extends StatefulWidget {
  const _EquipmentFormSheet({
    this.existing,
    required this.teams,
    required this.clubSport,
    required this.managementAccent,
  });

  final ClubEquipmentItem? existing;
  final List<ClubTeam> teams;
  final String clubSport;
  final Color managementAccent;

  @override
  State<_EquipmentFormSheet> createState() => _EquipmentFormSheetState();
}

class _EquipmentFormSheetState extends State<_EquipmentFormSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _customCategoryController;
  late final TextEditingController _quantityController;
  late final TextEditingController _locationController;
  late final TextEditingController _notesController;
  late final List<String> _categoryLabels;
  late String _categoryPreset;
  late String _condition;
  String? _assignedTeamId;
  String? _error;

  static const _denseDecoration = InputDecoration(
    isDense: true,
    contentPadding: EdgeInsets.symmetric(
      horizontal: ViroSpacing.md,
      vertical: ViroSpacing.sm + 2,
    ),
  );

  @override
  void initState() {
    super.initState();
    _categoryLabels = EquipmentCategoryPresets.forSport(widget.clubSport);
    final existing = widget.existing;
    final storedCategory = existing?.category ?? '';
    _categoryPreset = EquipmentCategoryPresets.presetForStored(
      storedCategory,
      _categoryLabels,
    );
    _nameController = TextEditingController(text: existing?.name ?? '');
    _customCategoryController = TextEditingController(
      text: EquipmentCategoryPresets.isOther(_categoryPreset)
          ? storedCategory
          : '',
    );
    _quantityController = TextEditingController(
      text: '${existing?.quantity ?? 1}',
    );
    _locationController = TextEditingController(text: existing?.location ?? '');
    _notesController = TextEditingController(text: existing?.notes ?? '');
    _condition = existing?.condition ?? EquipmentConditions.ok;
    _assignedTeamId = existing?.assignedTeamId;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _customCategoryController.dispose();
    _quantityController.dispose();
    _locationController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  bool get _showOtherCategory =>
      EquipmentCategoryPresets.isOther(_categoryPreset);

  bool get _needsScroll {
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    return keyboardOpen || _showOtherCategory;
  }

  bool get _isFormValid {
    final name = _nameController.text.trim();
    final category = EquipmentCategoryPresets.storedValue(
      preset: _categoryPreset,
      customLabel: _customCategoryController.text,
    );
    final quantity = int.tryParse(_quantityController.text.trim()) ?? 0;
    return name.isNotEmpty && category.isNotEmpty && quantity > 0;
  }

  void _submit() {
    final name = _nameController.text.trim();
    final category = EquipmentCategoryPresets.storedValue(
      preset: _categoryPreset,
      customLabel: _customCategoryController.text,
    );
    final quantity = int.tryParse(_quantityController.text.trim()) ?? 0;

    if (name.isEmpty) {
      setState(() => _error = 'Indiquez un nom.');
      return;
    }
    if (category.isEmpty) {
      setState(
        () => _error = _showOtherCategory
            ? 'Précisez le type.'
            : 'Choisissez un type.',
      );
      return;
    }
    if (quantity <= 0) {
      setState(() => _error = 'Quantité min. 1.');
      return;
    }

    Navigator.pop(
      context,
      ClubEquipmentInput(
        name: name,
        category: category,
        quantity: quantity,
        condition: _condition,
        location: _locationController.text.trim(),
        assignedTeamId: _assignedTeamId,
        notes: _notesController.text.trim(),
      ),
    );
  }

  Widget _conditionChip(String value, String label) {
    final accent = widget.managementAccent;
    final selected = _condition == value;
    return FilterChip(
      label: Center(
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: selected ? ViroColors.white : accent,
                fontWeight: FontWeight.w600,
              ),
        ),
      ),
      selected: selected,
      onSelected: (_) => setState(() => _condition = value),
      showCheckmark: false,
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      selectedColor: accent,
      backgroundColor: ViroColors.gray50,
      side: BorderSide(color: selected ? accent : ViroColors.gray200),
      padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.xs),
    );
  }

  Widget _formBody(ThemeData theme) {
    return ViroCard(
      accentColor: widget.managementAccent,
      padding: const EdgeInsets.all(ViroSpacing.md),
      margin: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _nameController,
            textCapitalization: TextCapitalization.sentences,
            decoration: _denseDecoration.copyWith(
              labelText: 'Nom',
              hintText: 'Ballon match',
            ),
            onChanged: (_) => setState(() => _error = null),
          ),
          const SizedBox(height: ViroSpacing.sm),
          DropdownButtonFormField<String>(
            key: ValueKey('cat_$_categoryPreset'),
            initialValue: _showOtherCategory ||
                    !_categoryLabels.contains(_categoryPreset)
                ? EquipmentCategoryPresets.other
                : _categoryPreset,
            decoration: _denseDecoration.copyWith(
              labelText: 'Type',
            ),
            isDense: true,
            items: [
              for (final label in _categoryLabels)
                DropdownMenuItem(value: label, child: Text(label)),
              const DropdownMenuItem(
                value: EquipmentCategoryPresets.other,
                child: Text('Autre…'),
              ),
            ],
            onChanged: (value) {
              if (value == null) return;
              setState(() {
                _categoryPreset = value;
                _error = null;
                if (!EquipmentCategoryPresets.isOther(value)) {
                  _customCategoryController.clear();
                }
              });
            },
          ),
          if (_showOtherCategory) ...[
            const SizedBox(height: ViroSpacing.sm),
            TextField(
              controller: _customCategoryController,
              textCapitalization: TextCapitalization.sentences,
              decoration: _denseDecoration.copyWith(
                labelText: 'Préciser',
                hintText: 'Raquettes, plots…',
              ),
              onChanged: (_) => setState(() => _error = null),
            ),
          ],
          const SizedBox(height: ViroSpacing.sm),
          TextField(
            controller: _quantityController,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: _denseDecoration.copyWith(labelText: 'Quantité'),
            onChanged: (_) => setState(() => _error = null),
          ),
          const SizedBox(height: ViroSpacing.sm),
          Text(
            'État',
            style: theme.textTheme.labelSmall?.copyWith(
              color: ViroColors.gray600,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: ViroSpacing.xs),
          Row(
            children: [
              Expanded(
                child: _conditionChip(
                  EquipmentConditions.ok,
                  equipmentConditionLabel(EquipmentConditions.ok),
                ),
              ),
              const SizedBox(width: ViroSpacing.xs),
              Expanded(
                child: _conditionChip(
                  EquipmentConditions.use,
                  equipmentConditionLabel(EquipmentConditions.use),
                ),
              ),
              const SizedBox(width: ViroSpacing.xs),
              Expanded(
                child: _conditionChip(
                  EquipmentConditions.hs,
                  equipmentConditionLabel(EquipmentConditions.hs),
                ),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          TextField(
            controller: _locationController,
            textCapitalization: TextCapitalization.sentences,
            decoration: _denseDecoration.copyWith(
              labelText: 'Emplacement',
              hintText: 'Local U14…',
            ),
          ),
          const SizedBox(height: ViroSpacing.sm),
          DropdownButtonFormField<String?>(
            key: ValueKey('team_$_assignedTeamId'),
            initialValue: _assignedTeamId,
            decoration: _denseDecoration.copyWith(
              labelText: 'Équipe',
            ),
            isDense: true,
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('Aucune'),
              ),
              ...widget.teams.map(
                (team) => DropdownMenuItem<String?>(
                  value: team.id,
                  child: Text(team.name, overflow: TextOverflow.ellipsis),
                ),
              ),
            ],
            onChanged: (value) => setState(() => _assignedTeamId = value),
          ),
          const SizedBox(height: ViroSpacing.sm),
          TextField(
            controller: _notesController,
            maxLines: 1,
            textCapitalization: TextCapitalization.sentences,
            decoration: _denseDecoration.copyWith(
              labelText: 'Notes',
              hintText: 'Optionnel',
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isEdit = widget.existing != null;
    final scrollable = _needsScroll;

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                isEdit ? 'Modifier l’équipement' : 'Nouvel équipement',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: widget.managementAccent,
                ),
              ),
            ),
            IconButton(
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(
                minWidth: ViroSpacing.minTouchTarget,
                minHeight: ViroSpacing.minTouchTarget,
              ),
              icon: ViroIcon(ViroIcons.close, color: ViroColors.gray600),
              tooltip: 'Fermer',
              onPressed: () => Navigator.pop(context),
            ),
          ],
        ),
        const SizedBox(height: ViroSpacing.sm),
        _formBody(theme),
        if (_error != null) ...[
          const SizedBox(height: ViroSpacing.xs),
          Text(
            _error!,
            style: theme.textTheme.labelSmall?.copyWith(
              color: ViroColors.error,
            ),
          ),
        ],
        const SizedBox(height: ViroSpacing.sm),
        Row(
          children: [
            Expanded(
              child: ViroPrimaryButton(
                label: 'Annuler',
                outlined: true,
                onPressed: () => Navigator.pop(context),
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: ViroPrimaryButton(
                label: isEdit ? 'Enregistrer' : 'Créer',
                onPressed: _isFormValid ? _submit : null,
              ),
            ),
          ],
        ),
      ],
    );

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ViroSpacing.screenHorizontal,
          ViroSpacing.xs,
          ViroSpacing.screenHorizontal,
          ViroSpacing.sm,
        ),
        child: scrollable
            ? SingleChildScrollView(child: content)
            : content,
      ),
    );
  }
}
