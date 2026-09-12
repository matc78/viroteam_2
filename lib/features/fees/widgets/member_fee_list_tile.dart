import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_status_chip.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Tuile suivi cotisations — vue terrain (reste dû en priorité).
class MemberFeeListTile extends StatelessWidget {
  const MemberFeeListTile({
    super.key,
    required this.fee,
    required this.season,
    required this.selected,
    required this.selectionMode,
    required this.onTap,
    required this.onLongPress,
    this.onMenu,
    this.showMenu = true,
  });

  final MemberFee fee;
  final FeeSeason season;
  final bool selected;
  final bool selectionMode;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final VoidCallback? onMenu;
  final bool showMenu;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final display = fee.displayStatus(season.paymentDeadlineAt);
    final tier = season.tierById(fee.tierId);
    final tierLabel = tier?.label ?? AppCopy.fees.tierUnassigned;
    final remainingCents = fee.remainingCents(season);
    final needsTier =
        fee.status != MemberFeeStatus.exonere &&
        (fee.tierId == null || fee.tierId!.isEmpty);

    final String subtitle;
    if (fee.status == MemberFeeStatus.exonere) {
      subtitle = AppCopy.fees.statusExonere;
    } else if (needsTier) {
      subtitle = AppCopy.fees.fieldNeedsTier;
    } else if (remainingCents > 0) {
      subtitle =
          '$tierLabel · ${AppCopy.fees.remainingAmount(formatFeeAmountCents(remainingCents))}';
    } else {
      subtitle = '$tierLabel · ${AppCopy.fees.fieldSettled}';
    }

    return ListTile(
      onTap: onTap,
      onLongPress: onLongPress,
      leading: selectionMode
          ? Checkbox(
              value: selected,
              onChanged: (_) => onTap(),
            )
          : CircleAvatar(
              child: Text(
                fee.memberDisplayName.isNotEmpty
                    ? fee.memberDisplayName[0].toUpperCase()
                    : '?',
              ),
            ),
      title: Text(
        fee.memberDisplayName,
        style: theme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(subtitle),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FeeStatusChip(status: display, compact: true),
          if (showMenu && onMenu != null) ...[
            const SizedBox(width: ViroSpacing.xs),
            IconButton(
              icon: ViroIcon(ViroIcons.moreVertical),
              onPressed: onMenu,
            ),
          ],
        ],
      ),
    );
  }
}
