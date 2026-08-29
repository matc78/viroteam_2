import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class OnboardingEntryScreen extends ConsumerWidget {
  const OnboardingEntryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context).textTheme;
    final authUser = ref.watch(authStateProvider).value;
    final profileAsync = ref.watch(viroUserProvider);
    final needsViroTeamAccount = authUser != null &&
        profileAsync.hasValue &&
        profileAsync.value == null;

    return ViroScaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.lg),
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Center(child: ViroLogo(height: 128)),
                          const SizedBox(height: ViroSpacing.xl),
                          if (needsViroTeamAccount) ...[
                            ViroCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      ViroIcon(
                                        ViroIcons.user,
                                        color: ViroColors.sportYellow,
                                        size: 20,
                                      ),
                                      const SizedBox(width: ViroSpacing.sm),
                                      Expanded(
                                        child: Text(
                                          'Compte ViroTeam introuvable',
                                          style: theme.titleSmall?.copyWith(
                                            color: ViroColors.primary800,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: ViroSpacing.sm),
                                  Text(
                                    'Tu es connecté(e) mais tu n’as pas encore de '
                                    'compte sur cet environnement. Crée ton compte '
                                    'ou rejoins un club avec un code d’invitation.',
                                    style: theme.bodyMedium?.copyWith(
                                      color: ViroColors.gray600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: ViroSpacing.lg),
                          ],
                          Text(
                            'Bienvenue sur ViroTeam',
                            style: theme.headlineMedium?.copyWith(
                              color: ViroColors.primary800,
                              fontWeight: FontWeight.w800,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: ViroSpacing.md),
                          Text(
                            'Gérez votre club sportif : planning, convocations, cotisations et communication — tout en un seul endroit.',
                            style: theme.bodyLarge?.copyWith(
                              color: ViroColors.gray600,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: ViroSpacing.xl),
                          _BenefitRow(
                            icon: ViroIcons.calendar,
                            iconColor: ViroColors.sportCyan,
                            text: 'Organisez entraînements et matchs',
                          ),
                          _BenefitRow(
                            icon: ViroIcons.users,
                            iconColor: ViroColors.sportGreen,
                            text: 'Suivez les réponses aux convocations',
                          ),
                          _BenefitRow(
                            icon: ViroIcons.bell,
                            iconColor: ViroColors.sportYellow,
                            text: 'Communiquez avec votre club',
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _AccentButton(
                            label: 'J\'ai un code d\'invitation',
                            color: ViroColors.sportGreen,
                            onPressed: () => context.push(AppRoutes.join),
                          ),
                          const SizedBox(height: ViroSpacing.sm),
                          _AccentButton(
                            label: 'Créer mon club',
                            color: ViroColors.primary600,
                            outlined: true,
                            onPressed: () => context.push(
                              needsViroTeamAccount
                                  ? '${AppRoutes.signup}?intent=founder&complete=1'
                                  : '${AppRoutes.signup}?intent=founder',
                            ),
                          ),
                          const SizedBox(height: ViroSpacing.md),
                          if (needsViroTeamAccount)
                            TextButton(
                              onPressed: () async {
                                await ref.read(authServiceProvider).signOut();
                                if (context.mounted) {
                                  context.go(AppRoutes.entry);
                                }
                              },
                              child: const Text('Se déconnecter'),
                            )
                          else
                            TextButton(
                              onPressed: () => context.push(AppRoutes.login),
                              child: const Text('Déjà un compte ? Se connecter'),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({
    required this.icon,
    required this.text,
    required this.iconColor,
  });

  final IconData icon;
  final String text;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.md),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: ViroIcon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bouton CTA coloré pour l'onboarding (plein ou outlined).
class _AccentButton extends StatelessWidget {
  const _AccentButton({
    required this.label,
    required this.color,
    required this.onPressed,
    this.outlined = false,
  });

  final String label;
  final Color color;
  final VoidCallback onPressed;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(ViroSpacing.cardRadius);

    if (outlined) {
      return SizedBox(
        width: double.infinity,
        height: ViroSpacing.buttonHeightLarge,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: color,
            side: BorderSide(color: color),
            shape: RoundedRectangleBorder(borderRadius: radius),
          ),
          child: Text(
            label,
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: color),
          ),
        ),
      );
    }

    return SizedBox(
      width: double.infinity,
      height: ViroSpacing.buttonHeightLarge,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: ViroColors.white,
          shape: RoundedRectangleBorder(borderRadius: radius),
          elevation: 0,
        ),
        child: Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
    );
  }
}
