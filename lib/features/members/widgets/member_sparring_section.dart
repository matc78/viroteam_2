import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_selectable_row.dart';

/// Équipes où [member] est joueur et que l'utilisateur gère (droit équipes ou
/// coach avec gestion d'effectif), triées par nom.
List<ClubTeam> sparringManageableTeams({
  required List<ClubTeam> teams,
  required ClubMember member,
  required bool Function(String teamId) canManage,
}) {
  final manageable = [
    for (final team in teams)
      if (team.isOnPlayerRoster(member) && canManage(team.id)) team,
  ];
  manageable.sort(
    (left, right) => left.name.toLowerCase().compareTo(right.name.toLowerCase()),
  );
  return manageable;
}

/// Fiche membre : bascule sparring par équipe (cochée = sparring, non
/// convoqué d'office aux matchs). Masquée si aucune équipe n'est gérable.
class MemberSparringSection extends ConsumerStatefulWidget {
  const MemberSparringSection({
    super.key,
    required this.clubId,
    required this.member,
    required this.accent,
    required this.borderColor,
    required this.titleBuilder,
  });

  final String clubId;
  final ClubMember member;
  final Color accent;
  final Color borderColor;

  /// Titre de section dans le style de la fiche.
  final Widget Function(String label) titleBuilder;

  @override
  ConsumerState<MemberSparringSection> createState() =>
      _MemberSparringSectionState();
}

class _MemberSparringSectionState extends ConsumerState<MemberSparringSection> {
  String? _busyTeamId;

  Future<void> _toggle(ClubTeam team, bool sparring) async {
    if (_busyTeamId != null) return;
    setState(() => _busyTeamId = team.id);
    try {
      await ref.read(teamServiceProvider).setPlayerSparring(
            clubId: widget.clubId,
            teamId: team.id,
            memberId: widget.member.memberId,
            sparring: sparring,
          );
      if (mounted) {
        ViroSnackBar.show(
          context,
          AppCopy.teams.sparringUpdated(
            memberName: widget.member.fullName,
            sparring: sparring,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
      }
    } finally {
      if (mounted) setState(() => _busyTeamId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final teams = ref.watch(clubTeamsProvider(widget.clubId)).value ?? [];
    final access = ref.watch(clubAccessProvider(widget.clubId));
    final manageable = sparringManageableTeams(
      teams: teams,
      member: widget.member,
      canManage: access.canAddPlayerToTeam,
    );
    if (manageable.isEmpty) return const SizedBox.shrink();

    final hintStyle = Theme.of(context)
        .textTheme
        .bodySmall
        ?.copyWith(color: context.viroPalette.textSecondary);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: ViroSpacing.lg),
        widget.titleBuilder(AppCopy.members.sparringSectionTitle),
        const SizedBox(height: ViroSpacing.xs),
        Text(AppCopy.members.sparringSectionHint, style: hintStyle),
        const SizedBox(height: ViroSpacing.sm),
        ViroCard(
          margin: EdgeInsets.zero,
          padding: const EdgeInsets.all(ViroSpacing.xs),
          borderColor: widget.borderColor,
          accentColor: widget.accent,
          child: Column(
            children: [
              for (final team in manageable)
                ViroSelectableRow(
                  key: ValueKey(team.id),
                  selected: team.isSparring(widget.member.memberId),
                  accentColor: widget.accent,
                  title: team.name,
                  onChanged: _busyTeamId == null
                      ? (sparring) => _toggle(team, sparring)
                      : null,
                ),
            ],
          ),
        ),
      ],
    );
  }
}
