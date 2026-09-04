import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/widgets/club_audience_switcher.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_status_chip.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class MyFeeScreen extends ConsumerStatefulWidget {
  const MyFeeScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<MyFeeScreen> createState() => _MyFeeScreenState();
}

class _MyFeeScreenState extends ConsumerState<MyFeeScreen> {
  String? _audienceId;

  @override
  void initState() {
    super.initState();
    _resolveAudience();
  }

  Future<void> _resolveAudience() async {
    final clubId = widget.clubId;
    final target = ref.read(selectedClubAudienceProvider(clubId));
    if (target != null) {
      if (mounted) setState(() => _audienceId = target.memberId);
      return;
    }
    final authUid = ref.read(authStateProvider).value?.uid;
    if (authUid == null) return;
    final id = await ref.read(eventServiceProvider).resolveAudienceId(
          clubId: clubId,
          authUid: authUid,
        );
    if (mounted) setState(() => _audienceId = id);
  }

  @override
  Widget build(BuildContext context) {
    final selected = ref.watch(selectedClubAudienceProvider(widget.clubId));
    final selectedId = selected?.memberId;
    if (selectedId != null && selectedId != _audienceId) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _audienceId = selectedId);
      });
    }

    final title = selected?.isChild == true
        ? 'Cotisation de ${selected!.label}'
        : 'Ma cotisation';

    final memberAccent = ref.watch(clubMemberAccentProvider(widget.clubId));

    final audienceId = _audienceId;
    if (audienceId == null) {
      return ClubAccentTheme(
        accentColor: memberAccent,
        child: ViroScaffold(
        appBar: ViroAppBar(title: Text(title)),
        body: const Center(child: CircularProgressIndicator()),
        ),
      );
    }

    final feeAsync = ref.watch(
      myFeeProvider((clubId: widget.clubId, memberId: audienceId)),
    );

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
      appBar: ViroAppBar(
        title: Text(title),
      ),
      body: Column(
        children: [
          ClubAudienceSwitcher(clubId: widget.clubId),
          Expanded(
            child: feeAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => const ViroErrorState(
          message: 'Impossible de charger la cotisation',
        ),
        data: (data) {
          final season = data.season;
          if (season == null) {
            return ViroRefreshIndicator(
              onRefresh: () => ref.refresh(
                myFeeProvider(
                  (clubId: widget.clubId, memberId: audienceId),
                ).future,
              ),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(
                    height: 280,
                    child: ViroEmptyState(
                      message:
                          'Aucune saison de cotisation active.\nLe club te tiendra informé.',
                    ),
                  ),
                ],
              ),
            );
          }

          final fee = data.fee;
          if (fee == null) {
            return ViroRefreshIndicator(
              onRefresh: () => ref.refresh(
                myFeeProvider(
                  (clubId: widget.clubId, memberId: audienceId),
                ).future,
              ),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: 280,
                    child: ViroEmptyState(
                      message: selected?.isChild == true
                          ? 'La cotisation de ${selected!.label} n\'a pas encore été paramétrée par le club.'
                          : 'Ta cotisation n\'a pas encore été paramétrée par le club.',
                    ),
                  ),
                ],
              ),
            );
          }

          return ViroRefreshIndicator(
            onRefresh: () async {
              await Future.wait([
                ref.refresh(
                  myFeeProvider(
                    (clubId: widget.clubId, memberId: audienceId),
                  ).future,
                ),
                ref.refresh(clubProvider(widget.clubId).future),
              ]);
            },
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: ProjectConfig.contentMaxWidth,
                ),
                child: _FeeContent(
                  season: season,
                  fee: fee,
                  clubId: widget.clubId,
                ),
              ),
            ),
          );
        },
            ),
          ),
        ],
      ),
      ),
    );
  }
}

class _FeeContent extends ConsumerWidget {
  const _FeeContent({
    required this.season,
    required this.fee,
    required this.clubId,
  });

  final FeeSeason season;
  final MemberFee fee;
  final String clubId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context).textTheme;
    final display = fee.displayStatus(season.paymentDeadlineAt);
    final tier = fee.resolveTier(season);
    final amount = fee.amountDueCents(season);
    final remaining = fee.remainingCents(season);
    final deadline = season.paymentDeadlineAt;
    final club = ref.watch(clubProvider(clubId)).value;
    final accent = ref.watch(clubMemberAccentProvider(clubId));
    final onlinePaymentEnabled = FeatureFlags.helloAssoPaymentsLive &&
        (club?.onlinePaymentEnabled ?? false);
    final canPay = display == MemberFeeDisplayStatus.aPayer ||
        display == MemberFeeDisplayStatus.enRetard ||
        display == MemberFeeDisplayStatus.echeanceAujourdhui ||
        display == MemberFeeDisplayStatus.partiel;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
      children: [
        if (season.seasonLabel.isNotEmpty)
          Text(
            season.seasonLabel,
            style: theme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: ViroColors.gray600,
            ),
          ),
        const SizedBox(height: ViroSpacing.md),

        if (display == MemberFeeDisplayStatus.enRetard) ...[
          _WarningCard(
            text:
                'Cotisation en retard. Merci de régulariser selon les consignes ci-dessous.',
          ),
          const SizedBox(height: ViroSpacing.md),
        ],

        if (display == MemberFeeDisplayStatus.echeanceAujourdhui) ...[
          _WarningCard(
            text:
                'Échéance aujourd\'hui — merci de régler votre cotisation avant la fin de la journée.',
          ),
          const SizedBox(height: ViroSpacing.md),
        ],

        if (display == MemberFeeDisplayStatus.paye) ...[
          ViroCard(
            child: Column(
              children: [
                ViroIcon(ViroIcons.check, color: ViroColors.success, size: 40),
                const SizedBox(height: ViroSpacing.sm),
                Text(
                  'Votre cotisation ${season.seasonLabel} est à jour',
                  textAlign: TextAlign.center,
                  style: theme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: ViroColors.success,
                  ),
                ),
                if (fee.paidAt != null) ...[
                  const SizedBox(height: ViroSpacing.sm),
                  Text(
                    'Confirmé le ${DateFormat.yMMMMd('fr_FR').format(fee.paidAt!)}',
                    style: theme.bodyMedium?.copyWith(
                      color: ViroColors.gray600,
                    ),
                  ),
                ],
                if (fee.paidVia == FeePaidVia.inApp ||
                    fee.paidVia == FeePaidVia.helloasso) ...[
                  const SizedBox(height: ViroSpacing.xs),
                  Text(
                    'Payé via HelloAsso',
                    style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
                  ),
                ],
                if (fee.paidVia == FeePaidVia.offline) ...[
                  const SizedBox(height: ViroSpacing.xs),
                  Text(
                    'Payé hors-ligne'
                    '${fee.offlineMethod != null ? ' (${FeePaymentMethods.label(fee.offlineMethod!)})' : ''}',
                    style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
                  ),
                ],
                if (amount > 0) ...[
                  const SizedBox(height: ViroSpacing.xs),
                  Text(
                    formatFeeAmountCents(amount),
                    style: theme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
                if (fee.receiptUrl != null && fee.receiptUrl!.isNotEmpty) ...[
                  const SizedBox(height: ViroSpacing.md),
                  TextButton.icon(
                    onPressed: () async {
                      final uri = Uri.tryParse(fee.receiptUrl!);
                      if (uri == null) return;
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    },
                    icon: ViroIcon(ViroIcons.share, color: accent),
                    label: const Text('Télécharger l\'attestation PDF'),
                  ),
                ],
              ],
            ),
          ),
        ] else if (display == MemberFeeDisplayStatus.exonere) ...[
          ViroCard(
            child: Text(
              'Vous êtes exonéré(e) de cotisation pour la saison ${season.seasonLabel}.',
              textAlign: TextAlign.center,
              style: theme.bodyLarge,
            ),
          ),
        ] else ...[
          ViroCard(
            accentColor: accent,
            borderColor: ClubAccentStyle(accent).border,
            child: Column(
              children: [
                Center(
                  child: Text(
                    formatFeeAmountCents(amount),
                    style: theme.displaySmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: accent,
                    ),
                  ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                Center(
                  child: FeeStatusChip(status: display),
                ),
                if (fee.amountPaidCents > 0 || fee.pendingAidsCents > 0) ...[
                  const SizedBox(height: ViroSpacing.sm),
                  Center(
                    child: Text(
                      [
                        if (fee.amountPaidCents > 0)
                          'Payé : ${formatFeeAmountCents(fee.amountPaidCents)}',
                        if (fee.pendingAidsCents > 0)
                          'Aide en attente : ${formatFeeAmountCents(fee.pendingAidsCents)}',
                        if (remaining > 0)
                          'Reste : ${formatFeeAmountCents(remaining)}',
                      ].join(' · '),
                      textAlign: TextAlign.center,
                      style: theme.bodyMedium?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                  ),
                ],
                if (tier != null) ...[
                  const SizedBox(height: ViroSpacing.sm),
                  Center(
                    child: Text(
                      'Catégorie : ${tier.label}',
                      style: theme.bodyLarge?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (fee.aids.isNotEmpty) ...[
            const SizedBox(height: ViroSpacing.md),
            ...fee.aids.map(
              (aid) => Padding(
                padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
                child: ViroCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${aid.label} · ${formatFeeAmountCents(aid.amountCents)}',
                          style: theme.bodyMedium,
                        ),
                      ),
                      Text(
                        aid.isValidated
                            ? 'Validée'
                            : aid.status == FeeAidStatuses.rejected
                                ? 'Refusée'
                                : 'Justificatif',
                        style: theme.labelSmall?.copyWith(
                          color: aid.isValidated
                              ? ViroColors.success
                              : ViroColors.warning,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: ViroSpacing.md),
          if (deadline != null)
            ViroCard(
              child: Row(
                children: [
                  ViroIcon(ViroIcons.calendar, color: accent),
                  const SizedBox(width: ViroSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Date limite',
                          style: theme.labelMedium?.copyWith(
                            color: ViroColors.gray600,
                          ),
                        ),
                        Text(
                          DateFormat.yMMMMd('fr_FR').format(deadline),
                          style: theme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else
            Text(
              'Pas de date limite',
              textAlign: TextAlign.center,
              style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
            ),
        ],

        if (canPay && onlinePaymentEnabled) ...[
          const SizedBox(height: ViroSpacing.lg),
          ViroPrimaryButton(
            label: 'Payer en ligne',
            onPressed: () => context.push(AppRoutes.clubFeePayPath(clubId)),
          ),
        ],

        const SizedBox(height: ViroSpacing.lg),

        if (canPay) ...[
          if (season.paymentInstructions.trim().isNotEmpty) ...[
            Text(
              'Consignes de paiement',
              style: theme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: ViroSpacing.sm),
            ViroCard(
              child: Text(
                season.paymentInstructions,
                style: theme.bodyMedium?.copyWith(height: 1.5),
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
          ],

          if (season.iban != null && season.iban!.trim().isNotEmpty) ...[
            ViroCard(
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'IBAN',
                          style: theme.labelMedium?.copyWith(
                            color: ViroColors.gray600,
                          ),
                        ),
                        const SizedBox(height: ViroSpacing.xs),
                        Text(
                          season.iban!,
                          style: theme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: ViroIcon(ViroIcons.copy, color: accent),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: season.iban!));
                      ViroSnackBar.show(context, 'IBAN copié');
                    },
                    tooltip: 'Copier',
                  ),
                ],
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
          ],

          if (season.paymentMethods.isNotEmpty) ...[
            Text(
              'Moyens de paiement acceptés',
              style: theme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: ViroSpacing.sm),
            Wrap(
              spacing: ViroSpacing.sm,
              children: [
                for (final method in season.paymentMethods)
                  Chip(
                    label: Text(FeePaymentMethods.label(method)),
                    backgroundColor: ViroColors.primary50,
                  ),
              ],
            ),
            const SizedBox(height: ViroSpacing.md),
          ],
        ],

        ViroCard(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ViroIcon(ViroIcons.bell, color: accent, size: 20),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: Text(
                  FeatureFlags.helloAssoPaymentsLive && onlinePaymentEnabled
                      ? 'Le paiement en ligne via HelloAsso est disponible '
                          'ci-dessus.'
                      : 'Le paiement en ligne via HelloAsso arrive bientôt. '
                          'En attendant, suivez les consignes du club.',
                  style: theme.bodySmall?.copyWith(
                    color: ViroColors.gray600,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: ViroSpacing.xl),
      ],
    );
  }
}

class _WarningCard extends StatelessWidget {
  const _WarningCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: ViroColors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        border: Border.all(color: ViroColors.error.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(ViroSpacing.md),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: ViroColors.error,
                height: 1.35,
              ),
        ),
      ),
    );
  }
}
