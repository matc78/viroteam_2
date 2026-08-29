import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/auth/widgets/auth_social_buttons.dart';
import 'package:viro_team_v2/features/join/providers/pending_invitation_provider.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';
import 'package:viro_team_v2/utils/auth_error_message.dart';
import 'package:viro_team_v2/utils/password_policy.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class SignUpScreen extends ConsumerStatefulWidget {
  const SignUpScreen({
    super.key,
    this.intentParam,
    this.codeParam,
  });

  final String? intentParam;
  final String? codeParam;

  @override
  ConsumerState<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends ConsumerState<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _googleLoading = false;
  bool _acceptedTerms = false;
  String? _error;
  bool _prefillApplied = false;

  void _applyInvitationPrefill(PendingInvitationState pending) {
    if (_prefillApplied || !pending.hasInvitation) return;

    final inv = pending.invitation!;
    var applied = false;

    final first = inv.firstName?.trim();
    if (first != null && first.isNotEmpty && _firstNameController.text.isEmpty) {
      _firstNameController.text = first;
      applied = true;
    }

    final last = inv.lastName?.trim();
    if (last != null && last.isNotEmpty && _lastNameController.text.isEmpty) {
      _lastNameController.text = last;
      applied = true;
    }

    final email = inv.email?.trim();
    if (email != null && email.isNotEmpty && _emailController.text.isEmpty) {
      _emailController.text = email;
      applied = true;
    }

    if (applied) _prefillApplied = true;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final intent = widget.intentParam == 'join'
          ? SignUpIntent.join
          : SignUpIntent.founder;
      ref.read(signUpIntentProvider.notifier).setIntent(intent);
      final code = widget.codeParam;
      if (code != null && code.isNotEmpty) {
        ref.read(pendingInviteCodeProvider.notifier).setCode(code);
        ref.read(pendingInvitationProvider.notifier).lookupCode(code);
      }
      if (intent == SignUpIntent.join) {
        _applyInvitationPrefill(ref.read(pendingInvitationProvider));
      }
    });
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_acceptedTerms) {
      setState(() {
        _error =
            'Tu dois accepter les CGU et la politique de confidentialité.';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final auth = ref.read(authServiceProvider);
      final cred = await auth.signUpWithEmail(
        email: _emailController.text,
        password: _passwordController.text,
      );
      final uid = cred.user!.uid;
      final email = _emailController.text.trim();
      final first = _firstNameController.text.trim();
      final last = _lastNameController.text.trim();

      final profile = ViroUser(
        uid: uid,
        email: email,
        emailNorm: email.toLowerCase(),
        firstName: first,
        lastName: last,
        displayName: '$first $last'.trim(),
        profileCompleted: false,
      );
      await ref.read(userServiceProvider).createUserProfile(profile);

      await _navigateAfterSignUp();
    } catch (e) {
      setState(() => _error = AuthErrorMessage.from(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _navigateAfterSignUp() async {
    if (!mounted) return;
    final intent = ref.read(signUpIntentProvider);
    final pending = ref.read(pendingInvitationProvider);

    if (intent == SignUpIntent.join && pending.hasInvitation) {
      context.go(AppRoutes.joinPreview);
    } else if (intent == SignUpIntent.founder) {
      context.go(AppRoutes.clubSetup);
    } else {
      context.go(AppRoutes.entry);
    }
  }

  Future<void> _signUpWithGoogle() async {
    if (!_acceptedTerms) {
      setState(() {
        _error =
            'Tu dois accepter les CGU et la politique de confidentialité.';
      });
      return;
    }
    setState(() {
      _googleLoading = true;
      _error = null;
    });

    try {
      final auth = ref.read(authServiceProvider);
      final cred = await auth.signInWithGoogle();
      final firebaseUser = cred.user;
      if (firebaseUser == null) {
        throw StateError('Utilisateur Firebase absent après Google Sign-In');
      }

      final userService = ref.read(userServiceProvider);
      final existingProfile = await userService.getUser(firebaseUser.uid);

      if (existingProfile == null) {
        final email = firebaseUser.email?.trim() ?? '';
        final names = splitGoogleDisplayName(firebaseUser.displayName);
        final first = names.firstName.isNotEmpty
            ? names.firstName
            : _firstNameController.text.trim();
        final last = names.lastName.isNotEmpty
            ? names.lastName
            : _lastNameController.text.trim();

        final profile = ViroUser(
          uid: firebaseUser.uid,
          email: email,
          emailNorm: email.toLowerCase(),
          firstName: first,
          lastName: last,
          displayName: firebaseUser.displayName?.trim() ?? '$first $last'.trim(),
          profileCompleted: false,
        );
        await userService.createUserProfile(profile);
      }

      await _navigateAfterSignUp();
    } on EmailUsedWithPasswordException catch (error) {
      final email = error.email?.trim();
      if (email != null && email.isNotEmpty) {
        _emailController.text = email;
      }
      setState(() {
        _error =
            'Un compte existe déjà avec cet e-mail. Connecte-toi avec ton mot de passe.';
      });
    } on AuthCanceledException {
      // Annulation volontaire.
    } catch (e) {
      setState(() => _error = 'Inscription Google impossible. Réessayez.');
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final intent = ref.watch(signUpIntentProvider);
    final isJoin = intent == SignUpIntent.join;
    final isBusy = _loading || _googleLoading;

    ref.listen(pendingInvitationProvider, (_, next) {
      if (isJoin) _applyInvitationPrefill(next);
    });

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: Text(isJoin ? 'Créer un compte' : 'Compte fondateur'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(ViroSpacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(child: ViroLogo(height: 96)),
                const SizedBox(height: ViroSpacing.sm),
                Center(
                  child: Container(
                    width: 40,
                    height: 3,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(2),
                      color: ViroColors.sportGreen,
                    ),
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
                TextFormField(
                  controller: _firstNameController,
                  decoration: const InputDecoration(
                    labelText: 'Prénom',
                    hintText: 'Tristan',
                  ),
                  validator: (v) =>
                      v != null && v.trim().length >= 2 ? null : 'Requis',
                ),
                const SizedBox(height: ViroSpacing.md),
                TextFormField(
                  controller: _lastNameController,
                  decoration: const InputDecoration(
                    labelText: 'Nom',
                    hintText: 'Heraud',
                  ),
                  validator: (v) =>
                      v != null && v.trim().length >= 2 ? null : 'Requis',
                ),
                const SizedBox(height: ViroSpacing.md),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                  validator: (v) =>
                      v != null && v.contains('@') ? null : 'Email invalide',
                ),
                const SizedBox(height: ViroSpacing.md),
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Mot de passe',
                    helperText: PasswordPolicy.hint,
                    helperMaxLines: 2,
                  ),
                  validator: PasswordPolicy.validate,
                ),
                const SizedBox(height: ViroSpacing.md),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      value: _acceptedTerms,
                      onChanged: isBusy
                          ? null
                          : (value) => setState(
                                () => _acceptedTerms = value ?? false,
                              ),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'J’accepte les CGU et la politique de confidentialité.',
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(color: ViroColors.gray600),
                            ),
                            Row(
                              children: [
                                TextButton(
                                  onPressed: () => openPortalUrl(
                                    portalPageUrl('/legal/cgu'),
                                  ),
                                  child: const Text('CGU'),
                                ),
                                TextButton(
                                  onPressed: () => openPortalUrl(
                                    portalPageUrl('/legal/privacy'),
                                  ),
                                  child: const Text('Confidentialité'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                if (_error != null) ...[
                  const SizedBox(height: ViroSpacing.md),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: ViroSpacing.xl),
                ViroPrimaryButton(
                  label: 'Créer mon compte',
                  isLoading: _loading,
                  onPressed: isBusy ? null : _submit,
                ),
                const AuthDivider(),
                GoogleSignInButton(
                  isLoading: _googleLoading,
                  onPressed: isBusy ? null : _signUpWithGoogle,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
