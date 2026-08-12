import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Séparateur « ou » entre auth classique et fournisseur social.
class AuthDivider extends StatelessWidget {
  const AuthDivider({super.key});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.outlineVariant;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: ViroSpacing.md),
      child: Row(
        children: [
          Expanded(child: Divider(color: color)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.sm),
            child: Text(
              'ou',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          Expanded(child: Divider(color: color)),
        ],
      ),
    );
  }
}

/// Bouton outlined pour connexion Google.
class GoogleSignInButton extends StatelessWidget {
  const GoogleSignInButton({
    super.key,
    required this.onPressed,
    this.isLoading = false,
  });

  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return ViroPrimaryButton(
      label: 'Continuer avec Google',
      outlined: true,
      isLoading: isLoading,
      onPressed: onPressed,
    );
  }
}

/// Découpe un nom complet Google en prénom / nom.
({String firstName, String lastName}) splitGoogleDisplayName(String? displayName) {
  final trimmed = displayName?.trim() ?? '';
  if (trimmed.isEmpty) {
    return (firstName: '', lastName: '');
  }

  final parts = trimmed.split(RegExp(r'\s+'));
  if (parts.length == 1) {
    return (firstName: parts.first, lastName: '');
  }

  return (
    firstName: parts.first,
    lastName: parts.sublist(1).join(' '),
  );
}
