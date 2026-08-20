import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/members/widgets/invite_parent_sheet.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/member_guardian.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Carte « Mon parent » pour le titulaire joueur de la fiche (compte lié).
class MyParentSection extends ConsumerWidget {
  const MyParentSection({
    super.key,
    required this.club,
    required this.member,
  });

  final Club club;
  final ClubMember member;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final guardianAsync = ref.watch(
      _myGuardianProvider((clubId: club.id, memberId: member.memberId)),
    );
    final theme = Theme.of(context).textTheme;

    return guardianAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (error, stackTrace) => Padding(
        padding: const EdgeInsets.only(bottom: ViroSpacing.md),
        child: ViroCard(
          padding: const EdgeInsets.all(ViroSpacing.md),
          child: Text(
            'Impossible de charger le parent pour le moment.',
            style: theme.bodySmall?.copyWith(color: ViroColors.error),
          ),
        ),
      ),
      data: (guardian) {
        return Padding(
          padding: const EdgeInsets.only(bottom: ViroSpacing.md),
          child: ViroCard(
            padding: const EdgeInsets.all(ViroSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Mon parent',
                  style: theme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: ViroColors.primary800,
                  ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  guardian.hasOccupant
                      ? [
                          guardian.displayName ??
                              guardian.email ??
                              'Parent invité',
                          if (guardian.inviteExpired)
                            'invitation expirée'
                          else if (guardian.isPending)
                            'en attente',
                        ].join(' · ')
                      : 'Aucun parent lié. Invite un parent pour qu’il suive '
                          'ton planning et ta cotisation.',
                  style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
                ),
                const SizedBox(height: ViroSpacing.md),
                ViroPrimaryButton(
                  label: guardian.hasOccupant
                      ? 'Gérer mon parent'
                      : 'Inviter un parent',
                  outlined: true,
                  onPressed: () async {
                    await showInviteParentSheet(
                      context,
                      club: club,
                      member: member,
                    );
                    ref.invalidate(
                      _myGuardianProvider(
                        (clubId: club.id, memberId: member.memberId),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

final _myGuardianProvider = FutureProvider.family<
    MemberGuardianView,
    ({String clubId, String memberId})>((ref, params) {
  return ref.read(guardianServiceProvider).getMemberGuardian(
        clubId: params.clubId,
        memberId: params.memberId,
      );
});
