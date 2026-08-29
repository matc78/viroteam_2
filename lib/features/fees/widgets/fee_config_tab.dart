import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/utils/fee_iban_validator.dart';
import 'package:viro_team_v2/features/fees/utils/fee_season_labels.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_tier_editor.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Formulaire admin : configuration saison cotisations (aligné portail `/fees`).
class FeeConfigTab extends ConsumerStatefulWidget {
  const FeeConfigTab({
    super.key,
    required this.clubId,
    this.accentColor,
    this.onSaved,
  });

  final String clubId;
  final Color? accentColor;
  final VoidCallback? onSaved;

  @override
  ConsumerState<FeeConfigTab> createState() => _FeeConfigTabState();
}

class _FeeConfigTabState extends ConsumerState<FeeConfigTab> {
  String? _syncKey;
  String _seasonLabel = defaultSeasonLabel();
  DateTime? _paymentDeadline;
  final _instructionsCtrl = TextEditingController();
  final _ibanCtrl = TextEditingController();
  final _helloAssoSlugCtrl = TextEditingController();
  List<String> _paymentMethods = const [
    FeePaymentMethods.virement,
    FeePaymentMethods.cheque,
    FeePaymentMethods.especes,
  ];
  List<FeeTier> _tiers = const [
    FeeTier(
      tierId: 'tier_default',
      label: 'Standard',
      amountCents: 0,
    ),
  ];
  bool _onlinePaymentEnabled = false;
  bool _saving = false;

  @override
  void dispose() {
    _instructionsCtrl.dispose();
    _ibanCtrl.dispose();
    _helloAssoSlugCtrl.dispose();
    super.dispose();
  }

  bool get _onlineCardAvailable => FeatureFlags.helloAssoPaymentsLive;

  List<String> get _configurablePaymentMethods =>
      FeePaymentMethods.seasonConfigOptions(
        includeOnlineCard: _onlineCardAvailable,
      );

  void _syncFromData({FeeSeason? season, required Club club}) {
    final key =
        '${season?.id ?? 'new'}:'
        '${club.onlinePaymentEnabled}:${club.helloAssoOrganizationSlug ?? ''}';
    if (_syncKey == key) return;
    _syncKey = key;

    if (season != null) {
      _seasonLabel = season.seasonLabel.isNotEmpty
          ? season.seasonLabel
          : defaultSeasonLabel();
      _paymentDeadline = season.paymentDeadlineAt;
      _instructionsCtrl.text = season.paymentInstructions;
      _ibanCtrl.text = season.iban ?? '';
      _paymentMethods = _normalizePaymentMethods(
        season.paymentMethods.isNotEmpty
            ? season.paymentMethods
            : const [
                FeePaymentMethods.virement,
                FeePaymentMethods.cheque,
                FeePaymentMethods.especes,
              ],
      );
      _tiers = season.tiers.isNotEmpty
          ? List<FeeTier>.from(season.tiers)
          : [
              FeeTier(
                tierId: 'tier_${DateTime.now().microsecondsSinceEpoch}',
                label: 'Standard',
                amountCents: 0,
              ),
            ];
    } else {
      _seasonLabel = defaultSeasonLabel();
      _paymentDeadline = null;
      _instructionsCtrl.text = '';
      _ibanCtrl.text = '';
      _paymentMethods = _normalizePaymentMethods(const [
        FeePaymentMethods.virement,
        FeePaymentMethods.cheque,
        FeePaymentMethods.especes,
      ]);
      _tiers = [
        FeeTier(
          tierId: 'tier_${DateTime.now().microsecondsSinceEpoch}',
          label: 'Standard',
          amountCents: 0,
        ),
      ];
    }

    _onlinePaymentEnabled = club.onlinePaymentEnabled;
    _helloAssoSlugCtrl.text = club.helloAssoOrganizationSlug ?? '';
  }

  List<String> _normalizePaymentMethods(Iterable<String> methods) {
    final normalized = FeePaymentMethods.withoutOnlineCard(methods);
    if (_onlineCardAvailable &&
        methods.contains(FeePaymentMethods.carteBancaire) &&
        !normalized.contains(FeePaymentMethods.carteBancaire)) {
      return [...normalized, FeePaymentMethods.carteBancaire];
    }
    return normalized;
  }

  List<String> _paymentMethodsForSave() =>
      _normalizePaymentMethods(_paymentMethods);

  bool get _canSave {
    if (_seasonLabel.trim().isEmpty) return false;
    if (_tiers.isEmpty) return false;
    if (_tiers.any((tier) =>
        tier.label.trim().isEmpty || tier.amountCents <= 0)) {
      return false;
    }
    if (!isValidIbanFormat(_ibanCtrl.text)) return false;
    if (FeatureFlags.helloAssoPaymentsLive &&
        _onlinePaymentEnabled &&
        _helloAssoSlugCtrl.text.trim().isEmpty) {
      return false;
    }
    return true;
  }

  Future<void> _pickPaymentDeadline() async {
    final initial = _paymentDeadline ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(DateTime.now().year - 1),
      lastDate: DateTime(DateTime.now().year + 3),
      locale: const Locale('fr', 'FR'),
    );
    if (picked == null || !mounted) return;
    setState(() => _paymentDeadline = picked);
  }

  void _setOnlinePayment(bool enabled) {
    setState(() {
      _onlinePaymentEnabled = enabled;
      if (!enabled) {
        _paymentMethods = _paymentMethods
            .where((method) => method != FeePaymentMethods.carteBancaire)
            .toList();
      }
    });
  }

  void _togglePaymentMethod(String method) {
    setState(() {
      if (_paymentMethods.contains(method)) {
        _paymentMethods = _paymentMethods.where((m) => m != method).toList();
      } else {
        _paymentMethods = [..._paymentMethods, method];
      }
    });
  }

  Future<void> _save(FeeSeason? activeSeason, Club club) async {
    if (!_canSave || _saving) return;

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      ViroSnackBar.show(context, 'Session expirée.');
      return;
    }

    setState(() => _saving = true);
    try {
      final feeService = ref.read(feeServiceProvider);
      final clubService = ref.read(clubServiceProvider);
      final iban = _ibanCtrl.text.trim().isEmpty
          ? null
          : normalizeIban(_ibanCtrl.text);
      final seasonPayload = FeeSeason(
        id: activeSeason?.id ?? '',
        seasonLabel: _seasonLabel.trim(),
        isActive: true,
        currency: 'EUR',
        paymentDeadlineAt: _paymentDeadline,
        paymentInstructions: _instructionsCtrl.text.trim(),
        paymentMethods: _paymentMethodsForSave(),
        iban: iban,
        tiers: _tiers,
        createdAt: activeSeason?.createdAt ?? DateTime.now(),
        updatedAt: DateTime.now(),
        createdBy: activeSeason?.createdBy ?? uid,
      );

      final wasNewSeason = activeSeason == null;
      if (activeSeason == null) {
        await feeService.createSeason(
          clubId: widget.clubId,
          season: seasonPayload,
        );
      } else {
        await feeService.updateSeason(
          clubId: widget.clubId,
          season: FeeSeason(
            id: activeSeason.id,
            seasonLabel: seasonPayload.seasonLabel,
            isActive: true,
            currency: seasonPayload.currency,
            paymentDeadlineAt: seasonPayload.paymentDeadlineAt,
            paymentInstructions: seasonPayload.paymentInstructions,
            paymentMethods: seasonPayload.paymentMethods,
            iban: seasonPayload.iban,
            tiers: seasonPayload.tiers,
            createdAt: activeSeason.createdAt,
            updatedAt: DateTime.now(),
            createdBy: activeSeason.createdBy,
          ),
        );
      }

      await clubService.updateOnlinePaymentConfig(
        clubId: widget.clubId,
        enabled: FeatureFlags.helloAssoPaymentsLive && _onlinePaymentEnabled,
        organizationSlug: _helloAssoSlugCtrl.text.trim(),
      );

      invalidateClubVisualCaches(ref, widget.clubId);
      if (mounted) {
        ViroSnackBar.show(context, 'Configuration enregistrée');
        if (wasNewSeason) {
          widget.onSaved?.call();
        }
      }
    } catch (error) {
      if (mounted) ViroSnackBar.show(context, 'Erreur : $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _sectionTitle(String title) {
    final accent = widget.accentColor ?? ViroColors.primary800;
    return Text(
      title,
      style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: accent,
          ),
    );
  }

  Widget _paymentMethodChip(String method) {
    final accent = widget.accentColor ?? ViroColors.primary600;
    final selected = _paymentMethods.contains(method);
    return FilterChip(
      label: Text(
        FeePaymentMethods.label(method),
        style: TextStyle(
          color: selected ? ViroColors.white : accent,
          fontWeight: FontWeight.w600,
        ),
      ),
      selected: selected,
      onSelected: (_) => _togglePaymentMethod(method),
      showCheckmark: false,
      selectedColor: accent,
      backgroundColor: ViroColors.gray50,
      side: BorderSide(color: selected ? accent : ViroColors.gray200),
    );
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.accentColor ?? ViroColors.primary800;
    final seasonAsync = ref.watch(activeSeasonProvider(widget.clubId));
    final clubAsync = ref.watch(clubProvider(widget.clubId));
    final dateFormat = DateFormat('dd/MM/yyyy');

    return seasonAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stackTrace) => const ViroErrorState(),
      data: (season) {
        return clubAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => const ViroErrorState(),
          data: (club) {
            if (club == null) {
              return const Center(child: Text('Club introuvable'));
            }

            _syncFromData(season: season, club: club);
            final seasonOptions = [...buildSeasonLabelOptions()];
            if (!seasonOptions.contains(_seasonLabel)) {
              seasonOptions.insert(0, _seasonLabel);
            }

            return ListView(
              padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
              children: [
                if (season == null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: ViroSpacing.md),
                    child: Text(
                      'Aucune saison active — enregistrez pour en créer une.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: ViroColors.gray600,
                          ),
                    ),
                  ),
                _sectionTitle('Saison'),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  'Libellé et échéance de paiement des cotisations.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroCard(
                  accentColor: accent,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<String>(
                        key: ValueKey(_seasonLabel),
                        initialValue: _seasonLabel,
                        decoration: const InputDecoration(
                          labelText: 'Libellé saison',
                        ),
                        items: seasonOptions
                            .map(
                              (label) => DropdownMenuItem(
                                value: label,
                                child: Text(label),
                              ),
                            )
                            .toList(),
                        onChanged: _saving
                            ? null
                            : (value) {
                                if (value == null) return;
                                setState(() => _seasonLabel = value);
                              },
                      ),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Date limite de paiement'),
                        subtitle: Text(
                          _paymentDeadline != null
                              ? dateFormat.format(_paymentDeadline!)
                              : 'Optionnelle',
                        ),
                        trailing: ViroIcon(
                          ViroIcons.calendar,
                          color: accent,
                        ),
                        onTap: _saving ? null : _pickPaymentDeadline,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.lg),
                _sectionTitle('Paiement'),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  'Instructions, IBAN et modes acceptés.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroCard(
                  accentColor: accent,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: _instructionsCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Instructions de paiement',
                          hintText: 'Ordre du chèque, coordonnées…',
                        ),
                        maxLines: 3,
                        enabled: !_saving,
                      ),
                      const SizedBox(height: ViroSpacing.sm),
                      TextField(
                        controller: _ibanCtrl,
                        decoration: const InputDecoration(
                          labelText: 'IBAN (virement)',
                          hintText: 'FR76…',
                        ),
                        enabled: !_saving,
                      ),
                      const SizedBox(height: ViroSpacing.md),
                      Text(
                        'Modes de paiement',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: ViroSpacing.sm),
                      Wrap(
                        spacing: ViroSpacing.xs,
                        runSpacing: ViroSpacing.xs,
                        children: [
                          for (final method in _configurablePaymentMethods)
                            _paymentMethodChip(method),
                        ],
                      ),
                    ],
                  ),
                ),
                if (FeatureFlags.helloAssoPaymentsLive) ...[
                  const SizedBox(height: ViroSpacing.lg),
                  _sectionTitle('HelloAsso'),
                  const SizedBox(height: ViroSpacing.sm),
                  ViroCard(
                    accentColor: accent,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Paiement en ligne'),
                          subtitle: const Text('Carte bancaire via HelloAsso'),
                          value: _onlinePaymentEnabled,
                          activeThumbColor: accent,
                          onChanged:
                              _saving ? null : (value) => _setOnlinePayment(value),
                        ),
                        if (_onlinePaymentEnabled)
                          TextField(
                            controller: _helloAssoSlugCtrl,
                            decoration: const InputDecoration(
                              labelText: 'Slug organisation HelloAsso',
                            ),
                            enabled: !_saving,
                          ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: ViroSpacing.lg),
                _sectionTitle('Paliers tarifaires'),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  'Un libellé et un montant par palier de cotisation.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                FeeTierEditor(
                  tiers: _tiers,
                  accentColor: accent,
                  onChanged: (next) => setState(() => _tiers = next),
                ),
                const SizedBox(height: ViroSpacing.lg),
                ViroPrimaryButton(
                  label: _saving ? 'Enregistrement…' : 'Enregistrer',
                  isLoading: _saving,
                  onPressed: !_canSave || _saving
                      ? null
                      : () => _save(season, club),
                ),
                const SizedBox(height: ViroSpacing.xl),
              ],
            );
          },
        );
      },
    );
  }
}
