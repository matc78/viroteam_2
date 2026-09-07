import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/widgets/auth_social_buttons.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/auth_exceptions.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _googleLoading = false;
  bool _obscurePassword = true;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// Affiche une erreur de connexion si l’écran est encore monté.
  void _showError(String message) {
    if (!mounted) return;
    setState(() => _error = message);
  }

  /// Connexion e-mail / mot de passe.
  ///
  /// Après Auth OK, [GoRouter] redirige seul (loading → home / signup?complete=1).
  /// On ne fait plus de getUser/context.go ici : l’écran est souvent démonté
  /// dès que [authStateProvider] émet, ce qui provoquait des crashes.
  Future<void> _submit() async {
    final formState = _formKey.currentState;
    if (formState == null || !formState.validate()) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final credential = await ref.read(authServiceProvider).signInWithEmail(
            email: _emailController.text,
            password: _passwordController.text,
          );
      if (credential.user == null) {
        _showError('Connexion impossible. Réessayez.');
      }
    } catch (_) {
      _showError('Connexion impossible. Vérifiez vos identifiants.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Connexion via Google Sign-In (navigation déléguée au routeur).
  Future<void> _signInWithGoogle() async {
    setState(() {
      _googleLoading = true;
      _error = null;
    });

    try {
      final credential = await ref.read(authServiceProvider).signInWithGoogle();
      if (credential.user == null) {
        _showError('Connexion Google impossible. Réessayez.');
      }
    } on EmailUsedWithPasswordException catch (error) {
      final email = error.email?.trim();
      if (email != null && email.isNotEmpty && mounted) {
        _emailController.text = email;
      }
      _showError(
        'Un compte existe déjà avec cet e-mail. Connecte-toi avec ton mot de passe.',
      );
    } on AuthCanceledException {
      // Annulation volontaire.
    } catch (_) {
      _showError('Connexion Google impossible. Réessayez.');
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBusy = _loading || _googleLoading;
    final errorMessage = _error;

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: const Text('Connexion'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(ViroSpacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(child: ViroLogo(height: 112)),
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
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                  validator: (v) =>
                      v != null && v.contains('@') ? null : 'Email invalide',
                ),
                const SizedBox(height: ViroSpacing.md),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Mot de passe',
                    suffixIcon: IconButton(
                      icon: ViroIcon(
                        _obscurePassword ? ViroIcons.eye : ViroIcons.eyeSlash,
                        semanticLabel: _obscurePassword
                            ? 'Afficher le mot de passe'
                            : 'Masquer le mot de passe',
                      ),
                      onPressed: () => setState(
                        () => _obscurePassword = !_obscurePassword,
                      ),
                    ),
                  ),
                  validator: (v) => v != null && v.length >= 6
                      ? null
                      : '6 caractères minimum',
                ),
                if (errorMessage != null) ...[
                  const SizedBox(height: ViroSpacing.md),
                  Text(
                    errorMessage,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
                const SizedBox(height: ViroSpacing.xl),
                ViroPrimaryButton(
                  label: 'Se connecter',
                  isLoading: _loading,
                  onPressed: isBusy ? null : _submit,
                ),
                const AuthDivider(),
                GoogleSignInButton(
                  isLoading: _googleLoading,
                  onPressed: isBusy ? null : _signInWithGoogle,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
