import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/members/utils/member_invite_feedback.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/services/member_invite_service.dart';
import 'package:viro_team_v2/services/member_service.dart';
import 'package:viro_team_v2/services/team_service.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_status_toast.dart';

/// Ouvre les actions de masse disponibles sur la sélection des membres.
///
/// Retourne `true` si une action a modifié la sélection (à désélectionner).
Future<bool?> showMemberBulkActionSheet(
  BuildContext context, {
  required String clubId,
  required Club club,
  required String sentByUid,
  required List<ClubMember> selectedMembers,
  required MemberInviteService memberInviteService,
  required MemberService memberService,
  required TeamService teamService,
  required List<ClubTeam> addableTeams,
  required bool canSendInvites,
  required bool canAddToTeam,
}) {
  final eligibleInviteMembers =
      selectedMembers.where((member) => member.canReceiveInviteEmail).toList();
  final playersToAdd = selectedMembers
      .where((member) => member.role == MemberRoles.player)
      .toList();

  return showModalBottomSheet<bool>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) => _MemberBulkActionSheet(
      selectedCount: selectedMembers.length,
      eligibleInviteCount: eligibleInviteMembers.length,
      playerCount: playersToAdd.length,
      addableTeams: addableTeams,
      canSendInvites: canSendInvites && eligibleInviteMembers.isNotEmpty,
      canAddToTeam: canAddToTeam &&
          playersToAdd.isNotEmpty &&
          addableTeams.isNotEmpty,
      onSendInvites: !canSendInvites || eligibleInviteMembers.isEmpty
          ? null
          : () async {
              try {
                await memberService.ensureMemberInvitations(
                  clubId: clubId,
                  club: club,
                  members: eligibleInviteMembers,
                  sentByUid: sentByUid,
                );
                final result = await memberInviteService.sendMemberInvites(
                  clubId: clubId,
                  memberIds: eligibleInviteMembers
                      .map((member) => member.memberId)
                      .toList(),
                );
                if (!sheetContext.mounted) return;
                Navigator.of(sheetContext).pop(true);
                showInviteSendFeedback(
                  context,
                  result: result,
                  members: eligibleInviteMembers,
                );
              } catch (error) {
                if (!sheetContext.mounted) return;
                Navigator.of(sheetContext).pop(false);
                ViroSnackBar.show(
                  context,
                  callableErrorMessage(
                    error,
                    fallback: 'Envoi des invitations impossible.',
                  ),
                );
              }
            },
      onAddToTeam: !canAddToTeam ||
              playersToAdd.isEmpty ||
              addableTeams.isEmpty
          ? null
          : (team) async {
              try {
                var added = 0;
                var skipped = 0;
                for (final member in playersToAdd) {
                  final alreadyOnTeam = member.hasLinkedAccount
                      ? team.isOnPlayerRoster(member)
                      : team.pendingPlayerIds.contains(member.memberId);
                  if (alreadyOnTeam) {
                    skipped += 1;
                    continue;
                  }
                  if (member.hasLinkedAccount) {
                    await teamService.addPlayerToTeam(
                      clubId: clubId,
                      teamId: team.id,
                      uid: member.effectiveUid,
                    );
                  } else {
                    await teamService.addPendingPlayerToTeam(
                      clubId: clubId,
                      teamId: team.id,
                      pendingId: member.memberId,
                    );
                  }
                  added += 1;
                }
                if (!sheetContext.mounted) return;
                Navigator.of(sheetContext).pop(true);
                ViroStatusToast.show(
                  context,
                  message: added > 0
                      ? '$added joueur${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} à ${team.name}'
                          '${skipped > 0 ? ' ($skipped déjà dans l’équipe)' : ''}.'
                      : 'Aucun joueur ajouté'
                          '${skipped > 0 ? ' (déjà dans l’équipe)' : ''}.',
                  success: added > 0,
                  duration: const Duration(seconds: 3),
                );
              } catch (error) {
                if (!sheetContext.mounted) return;
                Navigator.of(sheetContext).pop(false);
                ViroSnackBar.show(
                  context,
                  callableErrorMessage(
                    error,
                    fallback: 'Ajout à l’équipe impossible.',
                  ),
                );
              }
            },
    ),
  );
}

class _MemberBulkActionSheet extends StatefulWidget {
  const _MemberBulkActionSheet({
    required this.selectedCount,
    required this.eligibleInviteCount,
    required this.playerCount,
    required this.addableTeams,
    required this.canSendInvites,
    required this.canAddToTeam,
    required this.onSendInvites,
    required this.onAddToTeam,
  });

  final int selectedCount;
  final int eligibleInviteCount;
  final int playerCount;
  final List<ClubTeam> addableTeams;
  final bool canSendInvites;
  final bool canAddToTeam;
  final Future<void> Function()? onSendInvites;
  final Future<void> Function(ClubTeam team)? onAddToTeam;

  @override
  State<_MemberBulkActionSheet> createState() => _MemberBulkActionSheetState();
}

class _MemberBulkActionSheetState extends State<_MemberBulkActionSheet> {
  bool _pickingTeam = false;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final pluralSelected = widget.selectedCount > 1 ? 's' : '';
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(ViroSpacing.md),
        child: ViroCard(
          margin: EdgeInsets.zero,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '${widget.selectedCount} membre$pluralSelected sélectionné$pluralSelected',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              if (_busy)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: ViroSpacing.lg),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_pickingTeam)
                ..._buildTeamPicker(context)
              else ...[
                if (widget.canSendInvites)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: ViroIcon(ViroIcons.envelope),
                    title: const Text('Envoyer les invitations'),
                    subtitle: Text(
                      '${widget.eligibleInviteCount} non inscrit${widget.eligibleInviteCount > 1 ? 's' : ''} avec e-mail.',
                    ),
                    onTap: widget.onSendInvites == null
                        ? null
                        : () async {
                            setState(() => _busy = true);
                            await widget.onSendInvites!();
                          },
                  ),
                if (widget.canAddToTeam)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: ViroIcon(ViroIcons.groups),
                    title: const Text('Ajouter à une équipe'),
                    subtitle: Text(
                      '${widget.playerCount} joueur${widget.playerCount > 1 ? 's' : ''} sélectionné${widget.playerCount > 1 ? 's' : ''}.',
                    ),
                    onTap: () => setState(() => _pickingTeam = true),
                  ),
                if (!widget.canSendInvites && !widget.canAddToTeam)
                  Text(
                    'Aucune action disponible pour cette sélection.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildTeamPicker(BuildContext context) {
    return [
      Row(
        children: [
          IconButton(
            onPressed: () => setState(() => _pickingTeam = false),
            icon: ViroIcon(ViroIcons.chevronLeft),
          ),
          Expanded(
            child: Text(
              'Choisir une équipe',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ],
      ),
      const SizedBox(height: ViroSpacing.xs),
      ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 280),
        child: ListView.builder(
          shrinkWrap: true,
          itemCount: widget.addableTeams.length,
          itemBuilder: (context, index) {
            final team = widget.addableTeams[index];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: ViroIcon(ViroIcons.groups),
              title: Text(team.name),
              subtitle: (team.category ?? '').trim().isEmpty
                  ? null
                  : Text(team.category!),
              onTap: widget.onAddToTeam == null
                  ? null
                  : () async {
                      setState(() => _busy = true);
                      await widget.onAddToTeam!(team);
                    },
            );
          },
        ),
      ),
    ];
  }
}
