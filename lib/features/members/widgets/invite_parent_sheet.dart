import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/member_guardian.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/invite_message.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Ouvre la feuille d’invitation / révocation du parent (V1, plafond 1).
Future<void> showInviteParentSheet(
  BuildContext context, {
  required Club club,
  required ClubMember member,
}) {
  final accent = clubAccentColor(
    brandColorHex: club.brandColorHex,
    clubId: club.id,
  );

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => ClubAccentTheme(
      accentColor: accent,
      child: InviteParentSheet(club: club, member: member),
    ),
  );
}

/// Feuille : inviter (e-mail) ou révoquer le parent V1 d’une fiche joueur.
class InviteParentSheet extends ConsumerStatefulWidget {
  const InviteParentSheet({
    super.key,
    required this.club,
    required this.member,
  });

  final Club club;
  final ClubMember member;

  @override
  ConsumerState<InviteParentSheet> createState() => _InviteParentSheetState();
}

class _InviteParentSheetState extends ConsumerState<InviteParentSheet> {
  final _emailController = TextEditingController();
  MemberGuardianView? _guardian;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  String get _childFirstName => widget.member.preferredFirstName;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final view = await ref.read(guardianServiceProvider).getMemberGuardian(
            clubId: widget.club.id,
            memberId: widget.member.memberId,
          );
      if (!mounted) return;
      setState(() {
        _guardian = view;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  String _callableMessage(Object error) => callableErrorMessage(error);

  Future<void> _invite() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Saisis un e-mail valide');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref.read(guardianServiceProvider).inviteGuardian(
            clubId: widget.club.id,
            memberId: widget.member.memberId,
            email: email,
          );
      final message = buildGuardianInviteMessage(
        club: widget.club,
        code: result.code,
        childFirstName: _childFirstName,
      );
      await Clipboard.setData(ClipboardData(text: message));
      if (!mounted) return;
      ViroSnackBar.show(context, 'Invitation envoyée — message copié');
      ref.invalidate(clubParentsProvider(widget.club.id));
      await _load();
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _callableMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revoke() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(guardianServiceProvider).revokeGuardian(
            clubId: widget.club.id,
            memberId: widget.member.memberId,
            parentUid: _guardian?.parentUid,
          );
      if (!mounted) return;
      ViroSnackBar.show(context, 'Parent révoqué');
      ref.invalidate(clubParentsProvider(widget.club.id));
      await _load();
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _callableMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final occupying = _guardian?.hasOccupant == true;

    return Padding(
      padding: EdgeInsets.only(
        left: ViroSpacing.lg,
        right: ViroSpacing.lg,
        top: ViroSpacing.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + ViroSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Parent de $_childFirstName',
            style: theme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: Theme.of(context).appBarTheme.foregroundColor,
            ),
          ),
          const SizedBox(height: ViroSpacing.sm),
          Text(
            'Un parent par enfant. Il pourra voir le planning, '
            'répondre aux convocations et payer la cotisation.',
            style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
          ),
          const SizedBox(height: ViroSpacing.lg),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: ViroSpacing.lg),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (occupying) ...[
            Text(
              [
                _guardian!.displayName ?? _guardian!.email ?? 'Parent invité',
                if (_guardian!.inviteExpired)
                  'invitation expirée'
                else if (_guardian!.isPending)
                  'en attente',
              ].join(' · '),
              style: theme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
            ),
            if (_guardian!.invitationCode != null &&
                _guardian!.invitationCode!.isNotEmpty) ...[
              const SizedBox(height: ViroSpacing.xs),
              Text(
                'Code : ${_guardian!.invitationCode}',
                style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
              ),
            ],
            const SizedBox(height: ViroSpacing.lg),
            ViroPrimaryButton(
              label: 'Révoquer',
              outlined: true,
              isLoading: _busy,
              onPressed: _busy ? null : _revoke,
            ),
          ] else ...[
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'E-mail du parent',
              ),
              enabled: !_busy,
            ),
            const SizedBox(height: ViroSpacing.lg),
            ViroPrimaryButton(
              label: 'Inviter un parent',
              isLoading: _busy,
              onPressed: _busy ? null : _invite,
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: ViroSpacing.sm),
            Text(
              _error!,
              style: theme.bodySmall?.copyWith(color: ViroColors.error),
            ),
          ],
        ],
      ),
    );
  }
}
