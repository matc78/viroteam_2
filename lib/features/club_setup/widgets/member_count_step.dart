import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Étape effectif — carrousel horizontal de valeurs (sélection obligatoire).
class MemberCountStep extends StatefulWidget {
  const MemberCountStep({
    super.key,
    required this.memberCountRange,
    required this.onChanged,
  });

  final String? memberCountRange;
  final void Function(String range) onChanged;

  @override
  State<MemberCountStep> createState() => _MemberCountStepState();
}

class _MemberCountStepState extends State<MemberCountStep> {
  final ScrollController _scrollController = ScrollController();
  final Map<String, GlobalKey> _chipKeys = {
    for (final value in ClubMemberCountRanges.all) value: GlobalKey(),
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollSelectedIntoView(animated: false);
    });
  }

  @override
  void didUpdateWidget(covariant MemberCountStep oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.memberCountRange != widget.memberCountRange) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollSelectedIntoView(animated: true);
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  /// Centre la puce sélectionnée dans le viewport du carrousel.
  void _scrollSelectedIntoView({required bool animated}) {
    final selected = widget.memberCountRange;
    if (selected == null) return;
    final chipContext = _chipKeys[selected]?.currentContext;
    if (chipContext == null) return;
    Scrollable.ensureVisible(
      chipContext,
      alignment: 0.5,
      duration: animated ? ViroMotion.standard : Duration.zero,
      curve: ViroMotion.enter,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final values = ClubMemberCountRanges.all;
    final selected = widget.memberCountRange;
    final selectedIndex = selected == null ? -1 : values.indexOf(selected);
    final effectiveSelected = selectedIndex >= 0 ? selected : null;

    // Carrousel full-bleed (hors padding shell) pour un fade quasi bord à bord.
    return Padding(
      padding: const EdgeInsets.only(
        top: ViroSpacing.lg,
        bottom: ViroSpacing.xs,
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.lg),
              child: Text(
                'Combien de membres gérez-vous environ ?',
                textAlign: TextAlign.center,
                style: theme.bodySmall?.copyWith(
                  color: ViroColors.gray600,
                  height: 1.35,
                ),
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: (bounds) {
                  return const LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Colors.transparent,
                      Colors.black,
                      Colors.black,
                      Colors.transparent,
                    ],
                    stops: [0, 0.06, 0.94, 1],
                  ).createShader(bounds);
                },
                child: ListView.separated(
                  controller: _scrollController,
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.md,
                  ),
                  itemCount: values.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(width: ViroSpacing.sm),
                  itemBuilder: (context, index) {
                    final value = values[index];
                    final isSelected = effectiveSelected == value;
                    return _MemberCountChip(
                      key: _chipKeys[value],
                      label: ClubMemberCountRanges.label(value),
                      selected: isSelected,
                      onTap: () => widget.onChanged(value),
                    );
                  },
                ),
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.lg),
              child: Text(
                effectiveSelected == null
                    ? 'Faites glisser puis choisissez un effectif.'
                    : '≈ ${ClubMemberCountRanges.recapLabel(effectiveSelected)}',
                textAlign: TextAlign.center,
                style: theme.bodySmall?.copyWith(
                  color: ViroColors.gray600,
                  fontWeight: effectiveSelected != null
                      ? FontWeight.w600
                      : FontWeight.w400,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MemberCountChip extends StatelessWidget {
  const _MemberCountChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = ClubSetupUi.stepAccent(ClubSetupSteps.memberCount);

    return ViroPressable(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: AnimatedContainer(
        duration: ViroMotion.fast,
        curve: ViroMotion.enter,
        constraints: const BoxConstraints(minWidth: 48, minHeight: 44),
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm,
        ),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected
              ? accent.withValues(alpha: 0.14)
              : ViroColors.surfaceCard,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? accent : ViroColors.primary100,
            width: selected ? 2 : 1,
          ),
        ),
        child: Text(
          label,
          style: theme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800,
            color: selected ? accent : ViroColors.primary800,
          ),
        ),
      ),
    );
  }
}
