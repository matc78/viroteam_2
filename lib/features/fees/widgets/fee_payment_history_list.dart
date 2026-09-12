import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/fees/models/fee_payment_event.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';

/// Liste chronologique des transactions cotisation (ledger `payment_events`).
class FeePaymentHistoryList extends ConsumerWidget {
  const FeePaymentHistoryList({
    super.key,
    required this.clubId,
    required this.seasonId,
    required this.memberId,
    this.embedded = false,
  });

  final String clubId;
  final String seasonId;
  final String memberId;

  /// Si vrai, pas de titre section (déjà fourni par le parent).
  final bool embedded;

  static final _dateFormat = DateFormat('dd MMM yyyy · HH:mm', 'fr_FR');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(
      memberFeePaymentEventsProvider((
        clubId: clubId,
        seasonId: seasonId,
        memberId: memberId,
      )),
    );

    return eventsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: ViroSpacing.md),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => ViroErrorState(
        message: AppCopy.fees.paymentHistoryLoadError,
      ),
      data: (events) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!embedded) ...[
              Text(
                AppCopy.fees.paymentHistoryTitle,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: ViroColors.primary800,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: ViroSpacing.sm),
            ],
            if (events.isEmpty)
              Text(
                AppCopy.fees.paymentHistoryEmpty,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: ViroColors.gray600,
                    ),
              )
            else
              ...events.map((event) => _EventTile(event: event)),
          ],
        );
      },
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event});

  final FeePaymentEvent event;

  @override
  Widget build(BuildContext context) {
    final detail = event.detail;
    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      event.title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: ViroColors.primary800,
                          ),
                    ),
                  ),
                  const SizedBox(width: ViroSpacing.sm),
                  Text(
                    FeePaymentHistoryList._dateFormat.format(event.createdAt),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: ViroColors.gray600,
                        ),
                  ),
                ],
              ),
              if (detail.isNotEmpty) ...[
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  detail,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Affiche l’historique dans un bottom sheet.
Future<void> showFeePaymentHistorySheet({
  required BuildContext context,
  required String clubId,
  required String seasonId,
  required String memberId,
  String? memberDisplayName,
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) {
      return SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            left: ViroSpacing.screenHorizontal,
            right: ViroSpacing.screenHorizontal,
            bottom: MediaQuery.viewInsetsOf(sheetContext).bottom +
                ViroSpacing.md,
          ),
          child: SizedBox(
            height: MediaQuery.sizeOf(sheetContext).height * 0.55,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  AppCopy.fees.paymentHistoryTitle,
                  style: Theme.of(sheetContext).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: ViroColors.primary800,
                      ),
                ),
                if (memberDisplayName != null &&
                    memberDisplayName.isNotEmpty) ...[
                  const SizedBox(height: ViroSpacing.xs),
                  Text(
                    memberDisplayName,
                    style: Theme.of(sheetContext).textTheme.bodyMedium?.copyWith(
                          color: ViroColors.gray600,
                        ),
                  ),
                ],
                const SizedBox(height: ViroSpacing.md),
                Expanded(
                  child: SingleChildScrollView(
                    child: FeePaymentHistoryList(
                      clubId: clubId,
                      seasonId: seasonId,
                      memberId: memberId,
                      embedded: true,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}
