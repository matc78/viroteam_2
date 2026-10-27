import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/settings/widgets/settings_section_header.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/account_service.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Indique si [input] correspond au mot de confirmation (casse et espaces
/// ignorés).
bool isDeleteConfirmationTyped(String input) =>
    input.trim().toUpperCase() == AppCopy.settings.deleteConfirmWord;

/// Formulaire de suppression du compte : conséquences, mot de confirmation à
/// taper, mot de passe (ou fenêtre Google / Apple), puis appel à
/// [AccountService.deleteAccount].
class DeleteAccountForm extends ConsumerStatefulWidget {
  const DeleteAccountForm({super.key});

  @override
  ConsumerState<DeleteAccountForm> createState() => _DeleteAccountFormState();
}

class _DeleteAccountFormState extends ConsumerState<DeleteAccountForm> {
  final _confirmController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _confirmController.addListener(_onInputChanged);
    _passwordController.addListener(_onInputChanged);
  }

  @override
  void dispose() {
    _confirmController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _onInputChanged() => setState(() {});

  /// Supprime le compte puis renvoie vers l'écran d'entrée.
  Future<void> _delete({required bool needsPassword}) async {
    setState(() => _deleting = true);
    try {
      await ref.read(accountServiceProvider).deleteAccount(
            currentPassword: needsPassword ? _passwordController.text : null,
          );
      if (mounted) context.go(AppRoutes.entry);
    } on AuthCanceledException {
      // Annulation volontaire de la fenêtre Google / Apple.
    } on AccountDeletionException catch (error) {
      if (mounted) ViroSnackBar.show(context, error.message);
    } on FirebaseAuthException catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          error.code == 'wrong-password' || error.code == 'invalid-credential'
              ? AppCopy.settings.wrongPassword
              : callableErrorMessage(
                  error,
                  fallback: AppCopy.settings.deleteFailed,
                ),
        );
      }
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.settings.deleteFailed);
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final firebaseUser = ref.watch(authStateProvider).value;
    final needsPassword = firebaseUser != null &&
        AccountService.userHasPasswordProvider(firebaseUser);
    final reauthWithApple =
        firebaseUser != null && AccountService.reauthUsesApple(firebaseUser);
    final isClubAdmin = ref.watch(userClubsProvider).value?.any(
              (entry) => entry.membership?.role == MemberRoles.admin,
            ) ??
        false;

    final confirmed = isDeleteConfirmationTyped(_confirmController.text);
    final canSubmit = !_deleting &&
        firebaseUser != null &&
        confirmed &&
        (!needsPassword || _passwordController.text.isNotEmpty);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          AppCopy.settings.deleteAccountIntro,
          style: theme.bodyLarge?.copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: ViroSpacing.lg),
        SettingsSectionHeader(title: AppCopy.settings.deleteAccountWhatHappens),
        ViroCard(
          child: Column(
            children: [
              _ConsequenceRow(
                icon: ViroIcons.user,
                text: AppCopy.settings.deletePointProfile,
              ),
              _ConsequenceRow(
                icon: ViroIcons.groups,
                text: AppCopy.settings.deletePointClubs,
              ),
              _ConsequenceRow(
                icon: ViroIcons.envelope,
                text: AppCopy.settings.deletePointLinks,
              ),
              _ConsequenceRow(
                icon: ViroIcons.block,
                text: AppCopy.settings.deletePointSignIn,
                isLast: true,
              ),
            ],
          ),
        ),
        if (isClubAdmin) ...[
          const SizedBox(height: ViroSpacing.md),
          ViroCard(
            elevated: false,
            borderColor: ViroColors.warning.withValues(alpha: 0.5),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ViroIcon(ViroIcons.warning, color: palette.warningText),
                const SizedBox(width: ViroSpacing.sm),
                Expanded(
                  child: Text(
                    AppCopy.settings.deleteAccountAdminWarning,
                    style: theme.bodyMedium?.copyWith(
                      color: palette.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: ViroSpacing.xl),
        TextField(
          controller: _confirmController,
          enabled: !_deleting,
          textCapitalization: TextCapitalization.characters,
          autocorrect: false,
          enableSuggestions: false,
          decoration: InputDecoration(
            labelText: AppCopy.settings.deleteConfirmLabel,
            hintText: AppCopy.settings.deleteConfirmWord,
          ),
        ),
        const SizedBox(height: ViroSpacing.md),
        if (needsPassword)
          TextField(
            controller: _passwordController,
            enabled: !_deleting && confirmed,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: InputDecoration(
              labelText: AppCopy.settings.currentPassword,
            ),
          )
        else
          Text(
            reauthWithApple
                ? AppCopy.settings.appleConfirmWindow
                : AppCopy.settings.googleConfirmWindow,
            style: theme.bodySmall?.copyWith(color: palette.textSecondary),
          ),
        const SizedBox(height: ViroSpacing.xl),
        ElevatedButton(
          onPressed: canSubmit
              ? () => _delete(needsPassword: needsPassword)
              : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: ViroColors.error,
            foregroundColor: Colors.white,
          ),
          child: _deleting
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(AppCopy.settings.deleteAccountFinalAction),
        ),
        const SizedBox(height: ViroSpacing.sm),
        OutlinedButton(
          onPressed: _deleting
              ? null
              : () => context.canPop()
                  ? context.pop()
                  : context.go(AppRoutes.settingsAccount),
          child: Text(AppCopy.common.cancel),
        ),
      ],
    );
  }
}

/// Ligne « icône + conséquence » de la carte « Ce qui va se passer ».
class _ConsequenceRow extends StatelessWidget {
  const _ConsequenceRow({
    required this.icon,
    required this.text,
    this.isLast = false,
  });

  final IconData icon;
  final String text;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;

    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : ViroSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ViroIcon(icon, size: 20, color: palette.textSecondary),
          const SizedBox(width: ViroSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: palette.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}
