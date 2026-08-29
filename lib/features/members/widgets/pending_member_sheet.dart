import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/members/widgets/invite_email_button.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/invite_message.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Ouvre la fiche d’un membre pas encore inscrit (édition + invitation).
Future<void> showPendingMemberSheet(
  BuildContext context, {
  required Club club,
  required ClubMember member,
  required bool canEdit,
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
      child: PendingMemberSheet(
        club: club,
        member: member,
        canEdit: canEdit,
      ),
    ),
  );
}

/// Feuille : modifier l’identité d’un membre pending et partager l’invitation.
class PendingMemberSheet extends ConsumerStatefulWidget {
  const PendingMemberSheet({
    super.key,
    required this.club,
    required this.member,
    required this.canEdit,
  });

  final Club club;
  final ClubMember member;
  final bool canEdit;

  @override
  ConsumerState<PendingMemberSheet> createState() => _PendingMemberSheetState();
}

class _PendingMemberSheetState extends ConsumerState<PendingMemberSheet> {
  late ClubMember _currentMember;
  late final TextEditingController _firstNameController;
  late final TextEditingController _lastNameController;
  late final TextEditingController _emailController;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _currentMember = widget.member;
    _firstNameController = TextEditingController(
      text: widget.member.firstName ?? '',
    );
    _lastNameController = TextEditingController(
      text: widget.member.lastName ?? '',
    );
    _emailController = TextEditingController(text: widget.member.email ?? '');
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  ClubMember get _member => _currentMember;

  bool get _hasUnsavedChanges {
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final email = _emailController.text.trim();
    return firstName != (_member.firstName ?? '').trim() ||
        lastName != (_member.lastName ?? '').trim() ||
        email != (_member.email ?? '').trim();
  }

  bool get _hasValidInvite => _member.hasPendingInvite;

  bool get _showEmailAction {
    final email = _emailController.text.trim();
    return email.isNotEmpty && _hasValidInvite;
  }

  ClubInvitation _invitationFromMember() {
    return ClubInvitation(
      id: _member.activeInvitationId ?? '',
      clubId: widget.club.id,
      code: _member.pendingInviteCode ?? '',
      role: _member.role,
      status: InvitationStatus.pending,
      memberId: _member.memberId,
      expiresAt: _member.pendingInviteExpiresAt,
      clubName: widget.club.name,
    );
  }

  String? _validateEmail(String rawEmail) {
    final trimmed = rawEmail.trim();
    if (trimmed.isEmpty) return null;
    if (!trimmed.contains('@') || trimmed.startsWith('@')) {
      return 'Saisis un e-mail valide.';
    }
    return null;
  }

  Future<void> _saveProfile() async {
    if (!widget.canEdit || _busy) return;

    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final email = _emailController.text.trim();

    if (firstName.isEmpty || lastName.isEmpty) {
      setState(() => _error = 'Le prénom et le nom sont obligatoires.');
      return;
    }

    final emailError = _validateEmail(email);
    if (emailError != null) {
      setState(() => _error = emailError);
      return;
    }

    final unchanged = !_hasUnsavedChanges;
    if (unchanged) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await ref.read(memberServiceProvider).updatePendingMemberProfile(
            clubId: widget.club.id,
            memberId: _member.memberId,
            firstName: firstName,
            lastName: lastName,
            email: email,
          );
      if (!mounted) return;
      setState(() {
        _currentMember = ClubMember(
          memberId: _member.memberId,
          role: _member.role,
          status: _member.status,
          accountUid: _member.accountUid,
          firstName: firstName,
          lastName: lastName,
          displayName: '$firstName $lastName',
          avatarUrl: _member.avatarUrl,
          email: email.isEmpty ? null : email,
          teamIds: _member.teamIds,
          joinedAt: _member.joinedAt,
          activeInvitationId: _member.activeInvitationId,
          pendingInviteCode: _member.pendingInviteCode,
          pendingInviteExpiresAt: _member.pendingInviteExpiresAt,
          hasLinkedAccount: _member.hasLinkedAccount,
          dismissedAnnouncementIds: _member.dismissedAnnouncementIds,
        );
        _busy = false;
      });
      ViroSnackBar.show(context, 'Identité mise à jour');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _busy = false;
      });
    }
  }

  Future<bool> _sendEmailInvite() async {
    if (_hasUnsavedChanges) {
      await _saveProfile();
      if (_hasUnsavedChanges || _busy) return false;
    }

    try {
      final result =
          await ref.read(memberInviteServiceProvider).sendMemberInvites(
                clubId: widget.club.id,
                memberIds: [_member.memberId],
              );
      if (result.sent > 0) return true;
      final first = result.results.isNotEmpty ? result.results.first : null;
      throw Exception(
        first?.reason ?? 'Impossible d\'envoyer l\'invitation.',
      );
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          callableErrorMessage(
            error,
            fallback: 'Envoi de l\'invitation impossible.',
          ),
        );
      }
      return false;
    }
  }

  Future<void> _copyInvite() async {
    if (_member.pendingInviteCode == null) return;
    final message = buildInviteMessage(
      club: widget.club,
      invitation: _invitationFromMember(),
    );
    await Clipboard.setData(ClipboardData(text: message));
    if (!mounted) return;
    ViroSnackBar.show(context, 'Message copié dans le presse-papiers');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final titleColor = theme.appBarTheme.foregroundColor;
    final accent = theme.colorScheme.primary;

    return Padding(
      padding: EdgeInsets.only(
        left: ViroSpacing.lg,
        right: ViroSpacing.lg,
        top: ViroSpacing.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + ViroSpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Membre en attente',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: titleColor,
              ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Text(
              'Pas encore inscrit — modifiez l’identité ou partagez le code.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: ViroColors.gray600,
              ),
            ),
            const SizedBox(height: ViroSpacing.lg),
            TextField(
              controller: _firstNameController,
              textCapitalization: TextCapitalization.words,
              enabled: widget.canEdit && !_busy,
              decoration: const InputDecoration(labelText: 'Prénom *'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: ViroSpacing.md),
            TextField(
              controller: _lastNameController,
              textCapitalization: TextCapitalization.words,
              enabled: widget.canEdit && !_busy,
              decoration: const InputDecoration(labelText: 'Nom *'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: ViroSpacing.md),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              enabled: widget.canEdit && !_busy,
              decoration: const InputDecoration(
                labelText: 'E-mail (optionnel)',
                hintText: 'pour envoyer l’invitation par mail',
              ),
              onChanged: (_) => setState(() {}),
            ),
            if (_error != null) ...[
              const SizedBox(height: ViroSpacing.md),
              Text(
                _error!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: ViroColors.error,
                ),
              ),
            ],
            if (_member.pendingInviteCode != null) ...[
              const SizedBox(height: ViroSpacing.lg),
              Text(
                'Code d’invitation',
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: titleColor,
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              Text(
                _member.pendingInviteCode!,
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 3,
                  color: accent,
                ),
              ),
            ],
            if (_hasUnsavedChanges && widget.canEdit) ...[
              const SizedBox(height: ViroSpacing.sm),
              Text(
                'Enregistrez pour activer l’envoi par e-mail.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: ViroColors.gray600,
                ),
              ),
            ],
            const SizedBox(height: ViroSpacing.lg),
            if (widget.canEdit) ...[
              ViroPrimaryButton(
                label: _busy ? 'Enregistrement…' : 'Enregistrer',
                isLoading: _busy,
                onPressed: _busy || !_hasUnsavedChanges ? null : _saveProfile,
              ),
              const SizedBox(height: ViroSpacing.sm),
            ],
            if (_hasValidInvite) ...[
              if (_showEmailAction)
                InviteEmailButton(
                  onSend: _sendEmailInvite,
                  disabled: _busy || _hasUnsavedChanges,
                )
              else
                ViroPrimaryButton(
                  label: 'Copier le message',
                  outlined: true,
                  onPressed: _busy ? null : _copyInvite,
                ),
            ],
            const SizedBox(height: ViroSpacing.sm),
            ViroPrimaryButton(
              label: 'Fermer',
              outlined: true,
              onPressed: _busy ? null : () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}
