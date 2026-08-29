import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';

/// Segment Moi | prénom, ou puces enfants. Invisible si une seule cible.
class ClubAudienceSwitcher extends ConsumerWidget {
  const ClubAudienceSwitcher({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final targetsAsync = ref.watch(clubFamilyTargetsProvider(clubId));
    final selected = ref.watch(selectedClubAudienceProvider(clubId));
    final accent = ref.watch(clubMemberAccentProvider(clubId));

    return targetsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (targets) {
        if (!shouldShowAudienceSwitcher(targets)) {
          return const SizedBox.shrink();
        }

        return Padding(
          padding: const EdgeInsets.fromLTRB(
            ViroSpacing.screenHorizontal,
            ViroSpacing.sm,
            ViroSpacing.screenHorizontal,
            0,
          ),
          child: Wrap(
            spacing: ViroSpacing.sm,
            runSpacing: ViroSpacing.sm,
            children: [
              for (final target in targets)
                ChoiceChip(
                  label: Text(target.label),
                  selected: selected?.memberId == target.memberId,
                  onSelected: (_) => ref
                      .read(clubAudienceSelectionProvider.notifier)
                      .select(clubId: clubId, memberId: target.memberId),
                  selectedColor: accent,
                  labelStyle: TextStyle(
                    color: selected?.memberId == target.memberId
                        ? ViroColors.white
                        : accent,
                    fontWeight: FontWeight.w600,
                  ),
                  backgroundColor: ViroColors.gray50,
                  side: BorderSide(
                    color: selected?.memberId == target.memberId
                        ? accent
                        : ViroColors.gray200,
                  ),
                  showCheckmark: false,
                ),
            ],
          ),
        );
      },
    );
  }
}
