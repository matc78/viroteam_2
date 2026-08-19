import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/join/providers/pending_invitation_provider.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class JoinCodeScreen extends ConsumerStatefulWidget {
  const JoinCodeScreen({super.key, this.initialCode});

  /// Code prérempli via deep link `/join?code=…`.
  final String? initialCode;

  @override
  ConsumerState<JoinCodeScreen> createState() => _JoinCodeScreenState();
}

class _JoinCodeScreenState extends ConsumerState<JoinCodeScreen> {
  late final TextEditingController _codeController;
  final _codeFocusNode = FocusNode();
  bool _loading = false;
  bool _autoSubmitted = false;

  @override
  void initState() {
    super.initState();
    _codeController = TextEditingController(
      text: widget.initialCode?.trim().toUpperCase() ?? '',
    );
    if (_codeController.text.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_autoSubmitted && mounted) {
          _autoSubmitted = true;
          _validate();
        }
      });
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _codeFocusNode.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    _codeFocusNode.dispose();
    super.dispose();
  }

  Future<void> _validate() async {
    final code = _codeController.text.trim().toUpperCase();
    if (code.isEmpty) return;

    setState(() => _loading = true);
    final ok =
        await ref.read(pendingInvitationProvider.notifier).lookupCode(code);
    setState(() => _loading = false);

    if (!mounted) return;
    if (!ok) return;

    final auth = ref.read(authStateProvider).value;
    if (auth != null) {
      context.go(AppRoutes.joinPreview);
    } else {
      context.push('${AppRoutes.signup}?intent=join&code=$code');
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = ref.watch(pendingInvitationProvider);
    final theme = Theme.of(context).textTheme;

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: const Text('Rejoindre un club'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(ViroSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: ViroSpacing.xl),
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: ViroColors.sportGreen.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  alignment: Alignment.center,
                  child: ViroIcon(
                    ViroIcons.key,
                    size: 36,
                    color: ViroColors.sportGreen,
                  ),
                ),
              ),
              const SizedBox(height: ViroSpacing.lg),
              Text(
                'Entrez votre code',
                style: theme.headlineSmall?.copyWith(
                  color: ViroColors.primary800,
                  fontWeight: FontWeight.w800,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: ViroSpacing.sm),
              Text(
                'Demandez le code d\'invitation à votre entraîneur ou à l\'administrateur du club.',
                style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: ViroSpacing.xl),
              TextField(
                controller: _codeController,
                focusNode: _codeFocusNode,
                autocorrect: false,
                textAlign: TextAlign.center,
                style: theme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 4,
                  color: ViroColors.primary800,
                ),
                decoration: InputDecoration(
                  hintText: 'ASMP1K2E',
                  hintStyle: theme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 4,
                    color: ViroColors.gray200,
                  ),
                  filled: true,
                  fillColor: ViroColors.primary50.withValues(alpha: 0.5),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
                    borderSide: BorderSide(color: ViroColors.primary100),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
                    borderSide: BorderSide(color: ViroColors.primary100),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
                    borderSide: BorderSide(color: ViroColors.sportGreen, width: 2),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.lg,
                    vertical: ViroSpacing.md,
                  ),
                ),
                inputFormatters: [
                  TextInputFormatter.withFunction(
                    (oldValue, newValue) => TextEditingValue(
                      text: newValue.text.toUpperCase(),
                      selection: newValue.selection,
                    ),
                  ),
                ],
                onSubmitted: (_) => _validate(),
              ),
              if (pending.error != null) ...[
                const SizedBox(height: ViroSpacing.md),
                Text(
                  pending.error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ],
              const SizedBox(height: ViroSpacing.xl),
              ViroPrimaryButton(
                label: 'Valider le code',
                isLoading: _loading,
                onPressed: _validate,
              ),
              const SizedBox(height: ViroSpacing.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _HelpChip(
                    icon: ViroIcons.users,
                    iconColor: ViroColors.sportCyan,
                    label: 'Demandez à votre coach',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HelpChip extends StatelessWidget {
  const _HelpChip({
    required this.icon,
    required this.iconColor,
    required this.label,
  });

  final IconData icon;
  final Color iconColor;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: iconColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ViroIcon(icon, size: 18, color: iconColor),
          const SizedBox(width: ViroSpacing.sm),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: ViroColors.gray600,
                  fontWeight: FontWeight.w500,
                ),
          ),
        ],
      ),
    );
  }
}
