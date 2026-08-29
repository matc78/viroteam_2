import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/members/utils/member_team_labels.dart';
import 'package:viro_team_v2/features/members/widgets/change_role_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/invite_parent_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/member_guardian.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Ouvre la fiche récap d’un membre inscrit (statut, équipes, cotisation…).
Future<void> showMemberDetailSheet(
  BuildContext context, {
  required WidgetRef ref,
  required Club club,
  required ClubMember member,
  required String viewerRole,
  required Color accentColor,
  VoidCallback? onMemberRemoved,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    enableDrag: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => ClubAccentTheme(
      accentColor: accentColor,
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.58,
        minChildSize: 0.38,
        maxChildSize: 0.88,
        builder: (_, scrollController) => MemberDetailSheet(
          club: club,
          member: member,
          viewerRole: viewerRole,
          scrollController: scrollController,
          onMemberRemoved: onMemberRemoved,
        ),
      ),
    ),
  );
}

/// Fiche membre inscrit — layout mobile, couleurs de marque du club.
class MemberDetailSheet extends ConsumerStatefulWidget {
  const MemberDetailSheet({
    super.key,
    required this.club,
    required this.member,
    required this.viewerRole,
    required this.scrollController,
    this.onMemberRemoved,
  });

  final Club club;
  final ClubMember member;
  final String viewerRole;
  final ScrollController scrollController;
  final VoidCallback? onMemberRemoved;

  @override
  ConsumerState<MemberDetailSheet> createState() => _MemberDetailSheetState();
}

class _MemberDetailSheetState extends ConsumerState<MemberDetailSheet> {
  MemberGuardianView? _guardian;
  String? _license;
  bool _loadingExtras = true;
  bool _confirmRemove = false;
  bool _busy = false;

  bool get _isAdmin => widget.viewerRole == MemberRoles.admin;

  bool get _canSeeContact {
    if (_isAdmin) return true;
    final viewer = ref.read(clubMemberProvider(widget.club.id)).value;
    return viewer?.memberId == widget.member.memberId ||
        viewer?.accountUid == widget.member.accountUid;
  }

  ClubAccentStyle get _accentStyle => clubAccentStyle(
        brandColorHex: widget.club.brandColorHex,
        clubId: widget.club.id,
      );

  Color get _accent =>
      resolveClubBrandColors(
        brandColorHex: widget.club.brandColorHex,
        clubId: widget.club.id,
      ).managementZoneColor;

  @override
  void initState() {
    super.initState();
    _loadExtras();
  }

  Future<void> _loadExtras() async {
    setState(() => _loadingExtras = true);
    try {
      final memberService = ref.read(memberServiceProvider);
      final licenseFuture = memberService.getMemberLicense(
        clubId: widget.club.id,
        memberId: widget.member.memberId,
      );
      final guardianFuture = _isAdmin &&
              widget.member.role == MemberRoles.player
          ? ref.read(guardianServiceProvider).getMemberGuardian(
                clubId: widget.club.id,
                memberId: widget.member.memberId,
              )
          : Future<MemberGuardianView?>.value(null);

      final results = await Future.wait<Object?>([
        licenseFuture,
        guardianFuture,
      ]);

      if (!mounted) return;
      setState(() {
        _license = results[0] as String?;
        _guardian = results[1] as MemberGuardianView?;
        _loadingExtras = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingExtras = false);
    }
  }

  MemberFee? _feeForMember(List<MemberFee> fees) {
    for (final fee in fees) {
      if (fee.memberId == widget.member.memberId) return fee;
      final accountUid = widget.member.accountUid;
      if (accountUid != null && fee.memberId == accountUid) return fee;
    }
    return null;
  }

  Future<void> _changeRole() async {
    final newRole = await showChangeRoleSheet(
      context,
      member: widget.member,
      accentColor: _accent,
    );
    if (newRole == null || newRole == widget.member.role) return;

    setState(() => _busy = true);
    try {
      await ref.read(memberServiceProvider).updateMemberRole(
            clubId: widget.club.id,
            memberId: widget.member.memberId,
            newRole: newRole,
          );
      if (!mounted) return;
      ViroSnackBar.show(context, 'Rôle mis à jour');
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ViroSnackBar.show(context, 'Erreur : $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _removeMember() async {
    setState(() => _busy = true);
    try {
      await ref.read(memberServiceProvider).removeMember(
            clubId: widget.club.id,
            memberId: widget.member.memberId,
          );
      if (!mounted) return;
      widget.onMemberRemoved?.call();
      Navigator.of(context).pop();
      ViroSnackBar.show(context, 'Membre supprimé');
    } catch (error) {
      if (!mounted) return;
      ViroSnackBar.show(context, 'Erreur : $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openParentSheet() async {
    await showInviteParentSheet(
      context,
      club: widget.club,
      member: widget.member,
    );
    await _loadExtras();
  }

  String _roleLabel(String role) => switch (role) {
        MemberRoles.admin => 'Administrateur',
        MemberRoles.coach => 'Coach',
        _ => 'Joueur',
      };

  String? _parentSubtitle() {
    if (_loadingExtras) return null;
    final guardian = _guardian;
    if (guardian?.hasOccupant != true) {
      return 'Aucun parent lié';
    }
    final name = guardian!.displayName ?? guardian.email ?? 'Parent invité';
    if (guardian.inviteExpired) return '$name · invitation expirée';
    if (guardian.isPending) return '$name · en attente';
    return name;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textTheme = theme.textTheme;
    final accentStyle = _accentStyle;
    final accent = _accent;
    final teams = ref.watch(clubTeamsProvider(widget.club.id)).value ?? [];
    final fees = ref.watch(allMemberFeesProvider(widget.club.id)).value ?? [];
    final teamLabels = resolveMemberTeamLabels(widget.member, teams);
    final fee = _feeForMember(fees);
    final feeLabel = fee?.status.label ?? '—';
    final emailDisplay = _canSeeContact
        ? (widget.member.email?.trim().isNotEmpty == true
            ? widget.member.email!.trim()
            : '—')
        : '—';
    final showParentAction =
        _isAdmin && widget.member.role == MemberRoles.player;
    final showAdminActions = _isAdmin;
    final showDangerAction =
        _isAdmin && widget.member.role != MemberRoles.admin;
    final licenseValue = _loadingExtras
        ? '…'
        : (_license?.isNotEmpty == true ? _license! : '—');

    return Material(
      color: ViroColors.surfaceCard,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      clipBehavior: Clip.antiAlias,
      child: ListView(
              controller: widget.scrollController,
              padding: const EdgeInsets.fromLTRB(
                ViroSpacing.lg,
                ViroSpacing.sm,
                ViroSpacing.lg,
                ViroSpacing.xl,
              ),
              children: [
                _ProfileHeader(
                  member: widget.member,
                  accent: accent,
                  accentStyle: accentStyle,
                  subtitle: _canSeeContact &&
                          widget.member.email?.trim().isNotEmpty == true
                      ? widget.member.email!.trim()
                      : 'Compte lié',
                ),
                const SizedBox(height: ViroSpacing.lg),
                _SectionLabel(label: 'Informations', accent: accent),
                const SizedBox(height: ViroSpacing.sm),
                ViroCard(
                  margin: EdgeInsets.zero,
                  padding: EdgeInsets.zero,
                  borderColor: accentStyle.border,
                  accentColor: accent,
                  child: Column(
                    children: [
                      _InfoRow(
                        label: 'Inscription',
                        value: 'Compte lié',
                        accent: accent,
                      ),
                      _InfoDivider(color: accentStyle.border),
                      _InfoRow(
                        label: 'E-mail',
                        value: emailDisplay,
                        accent: accent,
                      ),
                      _InfoDivider(color: accentStyle.border),
                      _InfoRow(
                        label: 'Équipes',
                        value: teamLabels.isNotEmpty
                            ? teamLabels.join(', ')
                            : 'Aucune',
                        accent: accent,
                      ),
                      _InfoDivider(color: accentStyle.border),
                      _InfoRow(
                        label: 'Cotisation',
                        value: feeLabel,
                        accent: accent,
                      ),
                    ],
                  ),
                ),
                if (showAdminActions) ...[
                  const SizedBox(height: ViroSpacing.lg),
                  _SectionLabel(label: 'Administration', accent: accent),
                  const SizedBox(height: ViroSpacing.sm),
                  ViroCard(
                    margin: EdgeInsets.zero,
                    padding: EdgeInsets.zero,
                    borderColor: accentStyle.border,
                    accentColor: accent,
                    child: Column(
                      children: [
                        _InfoRow(
                          label: 'Licence',
                          value: licenseValue,
                          accent: accent,
                        ),
                        if (showParentAction) ...[
                          _InfoDivider(color: accentStyle.border),
                          _ActionRow(
                            label: 'Parent',
                            subtitle: _parentSubtitle(),
                            accent: accent,
                            loading: _loadingExtras,
                            onTap: _busy ? null : _openParentSheet,
                          ),
                        ],
                        _InfoDivider(color: accentStyle.border),
                        _ActionRow(
                          label: 'Rôle',
                          subtitle: _roleLabel(widget.member.role),
                          accent: accent,
                          onTap: _busy ? null : _changeRole,
                        ),
                      ],
                    ),
                  ),
                ],
                if (showDangerAction) ...[
                  const SizedBox(height: ViroSpacing.lg),
                  if (_confirmRemove) ...[
                    Text(
                      'Confirmer la suppression de ${widget.member.fullName} ?',
                      textAlign: TextAlign.center,
                      style: textTheme.bodyMedium?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                    const SizedBox(height: ViroSpacing.md),
                    FilledButton(
                      onPressed: _busy ? null : _removeMember,
                      style: FilledButton.styleFrom(
                        backgroundColor: ViroColors.error,
                        foregroundColor: ViroColors.white,
                        minimumSize: const Size.fromHeight(
                          ViroSpacing.buttonHeightLarge,
                        ),
                      ),
                      child: _busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: ViroColors.white,
                              ),
                            )
                          : const Text('Confirmer la suppression'),
                    ),
                    const SizedBox(height: ViroSpacing.sm),
                    OutlinedButton(
                      onPressed: _busy
                          ? null
                          : () => setState(() => _confirmRemove = false),
                      child: const Text('Annuler'),
                    ),
                  ] else
                    Center(
                      child: TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() => _confirmRemove = true),
                        style: TextButton.styleFrom(
                          foregroundColor: ViroColors.error,
                        ),
                        child: const Text('Supprimer le membre'),
                      ),
                    ),
                ],
              ],
            ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.member,
    required this.accent,
    required this.accentStyle,
    required this.subtitle,
  });

  final ClubMember member;
  final Color accent;
  final ClubAccentStyle accentStyle;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.md,
        ViroSpacing.sm,
        ViroSpacing.md,
        ViroSpacing.lg,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            accentStyle.surfaceTint,
            accentStyle.chipFill.withValues(alpha: 0.35),
            ViroColors.surfaceCard,
          ],
        ),
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        border: Border.all(color: accentStyle.border),
      ),
      child: Column(
        children: [
          MemberAvatar(member: member, accentColor: accent, size: 64),
          const SizedBox(height: ViroSpacing.sm),
          Text(
            member.fullName.isNotEmpty ? member.fullName : 'Sans nom',
            textAlign: TextAlign.center,
            style: textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: accent,
            ),
          ),
          const SizedBox(height: ViroSpacing.xs),
          ViroRoleBadge(
            role: viroRoleFromMemberRole(member.role),
            compact: true,
          ),
          const SizedBox(height: ViroSpacing.xs),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: textTheme.bodySmall?.copyWith(color: ViroColors.gray600),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({
    required this.label,
    required this.accent,
  });

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
            color: accent,
          ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    required this.accent,
  });

  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm + 2,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: textTheme.bodyMedium?.copyWith(
                color: ViroColors.gray600,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: accent,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.label,
    required this.accent,
    this.subtitle,
    this.loading = false,
    this.onTap,
  });

  final String label;
  final String? subtitle;
  final Color accent;
  final bool loading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return ViroPressable(
      onTap: onTap,
      borderRadius: BorderRadius.zero,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm + 2,
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: textTheme.bodyMedium?.copyWith(
                      color: ViroColors.gray600,
                    ),
                  ),
                  if (loading)
                    Padding(
                      padding: const EdgeInsets.only(top: ViroSpacing.xs),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: accent,
                        ),
                      ),
                    )
                  else if (subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        subtitle!,
                        style: textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: accent,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            ViroIcon(ViroIcons.chevronRight, size: 18, color: accent),
          ],
        ),
      ),
    );
  }
}

class _InfoDivider extends StatelessWidget {
  const _InfoDivider({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Divider(
      height: 1,
      thickness: 1,
      color: color.withValues(alpha: 0.5),
    );
  }
}
