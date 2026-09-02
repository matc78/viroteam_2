import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/members/widgets/invite_email_button.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/member_service.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/email_validation.dart';
import 'package:viro_team_v2/utils/invite_message.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Ouvre la feuille d’ajout membre (joueur / coach) avec écran succès.
Future<void> showAddMemberSheet(
  BuildContext context, {
  required Club club,
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
      child: AddMemberSheet(club: club),
    ),
  );
}

/// Feuille : ajouter un membre puis partager le code d’invitation.
class AddMemberSheet extends ConsumerStatefulWidget {
  const AddMemberSheet({super.key, required this.club});

  final Club club;

  @override
  ConsumerState<AddMemberSheet> createState() => _AddMemberSheetState();
}

class _AddMemberSheetState extends ConsumerState<AddMemberSheet> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  String _role = MemberRoles.player;
  bool _busy = false;
  String? _error;
  AddMemberResult? _created;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  /// Erreur de format e-mail affichée sous le champ (une fois saisi).
  String? get _emailFieldError {
    final rawEmail = _emailController.text;
    if (rawEmail.trim().isEmpty) return null;
    return requiredEmailError(rawEmail);
  }

  bool get _isFormValid =>
      _firstNameController.text.trim().isNotEmpty &&
      _lastNameController.text.trim().isNotEmpty &&
      requiredEmailError(_emailController.text) == null;

  ClubInvitation get _invitation => _created!.invitation;

  ClubMember get _member => _created!.member;

  Future<void> _createMember() async {
    if (!_isFormValid || _busy) return;

    final auth = ref.read(authStateProvider).value;
    if (auth == null) {
      setState(() => _error = 'Session expirée.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final result = await ref.read(memberServiceProvider).addMemberWithInvitation(
            clubId: widget.club.id,
            firstName: _firstNameController.text.trim(),
            lastName: _lastNameController.text.trim(),
            role: _role,
            sentByUid: auth.uid,
            club: widget.club,
            email: normalizeEmail(_emailController.text),
          );
      if (!mounted) return;
      setState(() {
        _created = result;
        _busy = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ArgumentError
            ? error.message.toString()
            : callableErrorMessage(
                error,
                fallback: 'Création du membre impossible.',
              );
        _busy = false;
      });
    }
  }

  Future<bool> _sendEmailInvite() async {
    try {
      final result = await ref.read(memberInviteServiceProvider).sendMemberInvites(
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
    final message = buildInviteMessage(
      club: widget.club,
      invitation: _invitation,
    );
    await Clipboard.setData(ClipboardData(text: message));
    if (!mounted) return;
    ViroSnackBar.show(context, 'Message copié dans le presse-papiers');
  }

  Widget _buildForm(ThemeData theme, Color titleColor) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Ajouter un membre',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: titleColor,
          ),
        ),
        const SizedBox(height: ViroSpacing.lg),
        TextField(
          controller: _firstNameController,
          textCapitalization: TextCapitalization.words,
          enabled: !_busy,
          decoration: const InputDecoration(labelText: 'Prénom *'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: ViroSpacing.md),
        TextField(
          controller: _lastNameController,
          textCapitalization: TextCapitalization.words,
          enabled: !_busy,
          decoration: const InputDecoration(labelText: 'Nom *'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: ViroSpacing.md),
        TextField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          enabled: !_busy,
          decoration: InputDecoration(
            labelText: 'E-mail *',
            hintText: 'seul ce compte pourra accepter l\'invitation',
            errorText: _emailFieldError,
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: ViroSpacing.md),
        SegmentedButton<String>(
          style: ClubAccentTheme.segmentedButtonStyle(
            theme.colorScheme.primary,
            theme.colorScheme.onPrimary,
          ),
          segments: const [
            ButtonSegment(
              value: MemberRoles.player,
              label: Text('Joueur'),
            ),
            ButtonSegment(
              value: MemberRoles.coach,
              label: Text('Coach'),
            ),
          ],
          selected: {_role},
          onSelectionChanged: _busy
              ? null
              : (selection) => setState(() => _role = selection.first),
        ),
        if (_error != null) ...[
          const SizedBox(height: ViroSpacing.md),
          Text(
            _error!,
            style: theme.textTheme.bodySmall?.copyWith(color: ViroColors.error),
          ),
        ],
        const SizedBox(height: ViroSpacing.lg),
        Row(
          children: [
            Expanded(
              child: ViroPrimaryButton(
                label: 'Annuler',
                outlined: true,
                onPressed: _busy ? null : () => Navigator.of(context).pop(),
              ),
            ),
            const SizedBox(width: ViroSpacing.md),
            Expanded(
              child: ViroPrimaryButton(
                label: _busy ? 'Création…' : 'Créer et inviter',
                isLoading: _busy,
                onPressed: _isFormValid && !_busy ? _createMember : null,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSuccess(ThemeData theme, Color titleColor, Color accent) {
    final hasEmail = _member.email?.trim().isNotEmpty ?? false;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Invitation créée',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: titleColor,
          ),
        ),
        const SizedBox(height: ViroSpacing.md),
        Text(
          '${_member.displayName} a été ajouté·e. Partagez ce code :',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: ViroColors.gray600,
          ),
        ),
        const SizedBox(height: ViroSpacing.md),
        Text(
          _invitation.code,
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: 4,
            color: accent,
          ),
        ),
        const SizedBox(height: ViroSpacing.lg),
        if (hasEmail)
          InviteEmailButton(
            onSend: _sendEmailInvite,
            disabled: _busy,
          )
        else
          ViroPrimaryButton(
            label: 'Copier le message',
            onPressed: _copyInvite,
          ),
        const SizedBox(height: ViroSpacing.sm),
        ViroPrimaryButton(
          label: 'Fermer',
          outlined: true,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
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
      child: _created == null
          ? _buildForm(theme, titleColor ?? ViroColors.primary800)
          : _buildSuccess(theme, titleColor ?? ViroColors.primary800, accent),
    );
  }
}
