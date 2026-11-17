import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_selection.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_status_chip.dart';
import 'package:viro_team_v2/widgets/common/viro_selection_mark.dart';

/// Tuile suivi cotisations — vue terrain (reste dû en priorité).
///
/// En mode sélection, la coche ronde prend la place de l'avatar et la ligne
/// sélectionnée se teinte, sans changer de hauteur.
class MemberFeeListTile extends StatelessWidget {
  const MemberFeeListTile({
    super.key,
    required this.fee,
    required this.season,
    required this.selected,
    required this.selectionMode,
    required this.onTap,
    this.onLongPress,
    this.onMenu,
    this.showMenu = true,
  });

  final MemberFee fee;
  final FeeSeason season;
  final bool selected;
  final bool selectionMode;
  final VoidCallback onTap;

  /// Appui long (sélection multiple) ; `null` en lecture seule.
  final VoidCallback? onLongPress;
  final VoidCallback? onMenu;
  final bool showMenu;

  /// Côté de l'emplacement de tête (avatar ou coche) : `CircleAvatar` par défaut.
  static const double _leadingSize = 40;

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
    final tint = ViroSelection.tintOf(ViroSelection.accentOf(context, null));
    final highlighted = selectionMode && selected;

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

    return AnimatedContainer(
      duration: ViroSelection.fillDuration,
      curve: ViroSelection.fillCurve,
      color: highlighted ? tint : tint.withValues(alpha: 0),
      // Material transparent : l'encre du ListTile se peint au-dessus de la
      // teinte au lieu d'être masquée par elle.
      child: Material(
        type: MaterialType.transparency,
        child: ListTile(
          onTap: () {
            if (selectionMode) ViroHaptics.selection();
            onTap();
          },
          onLongPress: onLongPress,
          leading: selectionMode
              ? Semantics(
                  checked: selected,
                  child: SizedBox.square(
                    dimension: _leadingSize,
                    child: Center(child: ViroSelectionMark(value: selected)),
                  ),
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
        ),
      ),
    );
  }
}
