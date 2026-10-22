import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';

class FeeStatusChip extends StatelessWidget {
  const FeeStatusChip({
    super.key,
    required this.status,
    this.compact = false,
  });

  final MemberFeeDisplayStatus status;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _colors(status, context.viroPalette);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: fg,
              fontWeight: FontWeight.w700,
              fontSize: compact ? 11 : 12,
            ),
      ),
    );
  }

  (Color, Color) _colors(
    MemberFeeDisplayStatus status,
    ViroPalette palette,
  ) =>
      switch (status) {
        MemberFeeDisplayStatus.paye => (
            Color.lerp(palette.surfaceCard, ViroColors.success, 0.15)!,
            palette.successText,
          ),
        MemberFeeDisplayStatus.exonere => (
            palette.surfaceMuted,
            palette.textSecondary,
          ),
        MemberFeeDisplayStatus.enRetard => (
            Color.lerp(palette.surfaceCard, ViroColors.error, 0.12)!,
            palette.errorText,
          ),
        MemberFeeDisplayStatus.echeanceAujourdhui => (
            Color.lerp(palette.surfaceCard, ViroColors.error, 0.12)!,
            palette.errorText,
          ),
        MemberFeeDisplayStatus.partiel => (
            Color.lerp(palette.surfaceCard, palette.accent, 0.12)!,
            palette.brandText,
          ),
        MemberFeeDisplayStatus.aPayer => (
            Color.lerp(palette.surfaceCard, ViroColors.warning, 0.15)!,
            palette.warningText,
          ),
      };
}
