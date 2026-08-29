import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/member_service.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/invite_message.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/lists/parent_list_tile.dart';

/// Liste club-wide des parents avec filtres et actions admin.
class ParentsSection extends ConsumerStatefulWidget {
  const ParentsSection({
    super.key,
    required this.clubId,
    required this.club,
    this.members = const [],
    this.accentColor,
  });

  final String clubId;
  final Club club;
  final List<ClubMember> members;
  final Color? accentColor;

  @override
  ConsumerState<ParentsSection> createState() => _ParentsSectionState();
}

class _ParentsSectionState extends ConsumerState<ParentsSection> {
  final _searchController = TextEditingController();
  String _search = '';
  String? _statusFilter;
  bool _busy = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<ClubParentEntry> _filter(List<ClubParentEntry> parents) {
    return parents.where((parent) {
      if (_statusFilter != null && parent.status != _statusFilter) {
        return false;
      }
      if (_search.isEmpty) return true;
      final haystack = [
        parent.displayName,
        parent.firstName ?? '',
        parent.lastName ?? '',
        parent.email ?? '',
        ...parent.children.map((c) => c.displayName),
      ].join(' ').toLowerCase();
      return haystack.contains(_search.toLowerCase());
    }).toList();
  }

  String _callableMessage(Object error) => callableErrorMessage(error);

  Future<void> _revoke(ClubParentEntry parent, ClubParentChildRef child) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Révoquer ce parent ?'),
        content: Text(
          'Le parent n’aura plus accès au suivi de ${child.displayName}.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Révoquer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    try {
      await ref.read(guardianServiceProvider).revokeGuardian(
            clubId: widget.clubId,
            memberId: child.memberId,
            parentUid: child.parentUid ?? parent.parentUid,
          );
      ref.invalidate(clubParentsProvider(widget.clubId));
      if (!mounted) return;
      ViroSnackBar.show(context, 'Parent révoqué');
    } catch (error) {
      if (!mounted) return;
      ViroSnackBar.show(context, _callableMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copyInvite(ClubParentEntry parent) async {
    final pending = parent.primaryPendingChild;
    final code = pending?.invitationCode;
    if (code == null || code.isEmpty || pending == null) return;
    final childFirst = pending.displayName.split(' ').first;
    final message = buildGuardianInviteMessage(
      club: widget.club,
      code: code,
      childFirstName: childFirst,
    );
    await Clipboard.setData(ClipboardData(text: message));
    if (!mounted) return;
    ViroSnackBar.show(context, 'Message d’invitation copié');
  }

  Future<void> _extend(ClubParentEntry parent) async {
    final pending = parent.primaryPendingChild;
    if (pending == null) return;
    setState(() => _busy = true);
    try {
      final result = await ref.read(guardianServiceProvider).extendGuardianInvite(
            clubId: widget.clubId,
            memberId: pending.memberId,
            invitationId: pending.invitationId,
          );
      ref.invalidate(clubParentsProvider(widget.clubId));
      if (!mounted) return;
      final date = result.expiresAt?.toLocal();
      ViroSnackBar.show(
        context,
        date != null
            ? 'Prolongée jusqu’au ${date.day}/${date.month}/${date.year}'
            : 'Invitation prolongée',
      );
    } catch (error) {
      if (!mounted) return;
      ViroSnackBar.show(context, _callableMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _regenerate(ClubParentEntry parent) async {
    final pending = parent.primaryPendingChild;
    if (pending == null) return;
    setState(() => _busy = true);
    try {
      final result =
          await ref.read(guardianServiceProvider).regenerateGuardianInvite(
                clubId: widget.clubId,
                memberId: pending.memberId,
                invitationId: pending.invitationId,
              );
      ref.invalidate(clubParentsProvider(widget.clubId));
      if (!mounted) return;
      ViroSnackBar.show(context, 'Nouveau code : ${result.code}');
    } catch (error) {
      if (!mounted) return;
      ViroSnackBar.show(context, _callableMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changeEmail(ClubParentEntry parent) async {
    final pending = parent.primaryPendingChild;
    if (pending == null) return;
    final controller = TextEditingController(text: parent.email ?? '');
    final next = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Changer l’e-mail'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'E-mail du parent'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (next == null || next.isEmpty || !next.contains('@')) return;

    setState(() => _busy = true);
    try {
      await ref.read(guardianServiceProvider).updateGuardianInviteEmail(
            clubId: widget.clubId,
            memberId: pending.memberId,
            email: next,
            invitationId: pending.invitationId,
          );
      ref.invalidate(clubParentsProvider(widget.clubId));
      if (!mounted) return;
      ViroSnackBar.show(context, 'E-mail mis à jour');
    } catch (error) {
      if (!mounted) return;
      ViroSnackBar.show(context, _callableMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _inviteFromList() async {
    final occupied = <String>{};
    final parents = ref.read(clubParentsProvider(widget.clubId)).value ?? [];
    for (final parent in parents) {
      for (final child in parent.children) {
        occupied.add(child.memberId);
      }
    }
    final candidates = widget.members
        .where(
          (m) =>
              !occupied.contains(m.memberId) &&
              m.role == MemberRoles.player,
        )
        .toList();
    if (candidates.isEmpty) {
      ViroSnackBar.show(context, 'Tous les joueurs ont déjà un parent');
      return;
    }

    var selected = candidates.first;
    final emailController = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Inviter un parent'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: selected.memberId,
                decoration: const InputDecoration(labelText: 'Enfant'),
                items: candidates
                    .map(
                      (m) => DropdownMenuItem(
                        value: m.memberId,
                        child: Text(m.fullName),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setDialogState(() {
                    selected =
                        candidates.firstWhere((m) => m.memberId == value);
                  });
                },
              ),
              const SizedBox(height: ViroSpacing.md),
              TextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                decoration:
                    const InputDecoration(labelText: 'E-mail du parent'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Inviter'),
            ),
          ],
        ),
      ),
    );
    final email = emailController.text.trim();
    emailController.dispose();
    if (submitted != true) return;
    if (!mounted) return;
    if (email.isEmpty || !email.contains('@')) {
      ViroSnackBar.show(context, 'Saisis un e-mail valide');
      return;
    }

    setState(() => _busy = true);
    try {
      final result = await ref.read(guardianServiceProvider).inviteGuardian(
            clubId: widget.clubId,
            memberId: selected.memberId,
            email: email,
          );
      final message = buildGuardianInviteMessage(
        club: widget.club,
        code: result.code,
        childFirstName: selected.firstName?.trim().isNotEmpty == true
            ? selected.firstName!.trim()
            : selected.fullName.split(' ').first,
      );
      await Clipboard.setData(ClipboardData(text: message));
      if (!mounted) return;
      ref.invalidate(clubParentsProvider(widget.clubId));
      ViroSnackBar.show(context, 'Parent invité — message copié');
    } catch (error) {
      if (!mounted) return;
      ViroSnackBar.show(context, _callableMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _chip({
    required String label,
    required bool selected,
    required ValueChanged<bool> onSelected,
  }) {
    final accent = widget.accentColor ?? ViroColors.primary600;
    return FilterChip(
      label: Text(
        label,
        style: TextStyle(
          color: selected ? ViroColors.white : accent,
          fontWeight: FontWeight.w600,
        ),
      ),
      selected: selected,
      onSelected: onSelected,
      showCheckmark: false,
      selectedColor: accent,
      backgroundColor: ViroColors.gray50,
      side: BorderSide(
        color: selected ? accent : ViroColors.gray200,
      ),
    );
  }

  String _statusLabel(ClubParentEntry parent) {
    if (parent.isActive) return 'Connecté';
    final pending = parent.primaryPendingChild;
    if (pending?.expiresAt != null) {
      final date = pending!.expiresAt!;
      final label =
          '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
      if (!pending.inviteValid) return 'Expirée le $label';
      return 'En attente · valable jusqu’au $label';
    }
    return 'En attente';
  }

  @override
  Widget build(BuildContext context) {
    final parentsAsync = ref.watch(clubParentsProvider(widget.clubId));
    final theme = Theme.of(context).textTheme;

    return parentsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(ViroSpacing.xl),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stackTrace) => const Padding(
        padding: EdgeInsets.all(ViroSpacing.lg),
        child: Text('Impossible de charger les parents'),
      ),
      data: (parents) {
        final filtered = _filter(parents);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ViroSpacing.screenHorizontal,
                ViroSpacing.md,
                ViroSpacing.screenHorizontal,
                ViroSpacing.sm,
              ),
              child: TextField(
                controller: _searchController,
                decoration: const InputDecoration(
                  hintText: 'Rechercher un parent…',
                ),
                onChanged: (value) =>
                    setState(() => _search = value.trim()),
              ),
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.screenHorizontal,
              ),
              child: Row(
                children: [
                  _chip(
                    label: 'Tous',
                    selected: _statusFilter == null,
                    onSelected: (_) => setState(() => _statusFilter = null),
                  ),
                  const SizedBox(width: ViroSpacing.xs),
                  _chip(
                    label: 'En attente',
                    selected: _statusFilter == GuardianStatuses.pending,
                    onSelected: (_) => setState(
                      () => _statusFilter = GuardianStatuses.pending,
                    ),
                  ),
                  const SizedBox(width: ViroSpacing.xs),
                  _chip(
                    label: 'Connectés',
                    selected: _statusFilter == GuardianStatuses.active,
                    onSelected: (_) => setState(
                      () => _statusFilter = GuardianStatuses.active,
                    ),
                  ),
                  const SizedBox(width: ViroSpacing.sm),
                  TextButton(
                    onPressed: _busy ? null : _inviteFromList,
                    child: const Text('Inviter'),
                  ),
                ],
              ),
            ),
            if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.all(ViroSpacing.xl),
                child: Text(
                  'Aucun parent pour le moment',
                  textAlign: TextAlign.center,
                  style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
                ),
              )
            else
              ...filtered.map((parent) {
                return Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.screenHorizontal,
                  ),
                  child: ParentListTile(
                    parent: parent,
                    busy: _busy,
                    statusLabel: _statusLabel(parent),
                    onCopyInvite: () => _copyInvite(parent),
                    onChangeEmail: () => _changeEmail(parent),
                    onExtend: () => _extend(parent),
                    onRegenerate: () => _regenerate(parent),
                    onRevokeChild: (child) => _revoke(parent, child),
                  ),
                );
              }),
            const SizedBox(height: ViroSpacing.xl),
          ],
        );
      },
    );
  }
}
