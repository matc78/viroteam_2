import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';

/// Overlay plein écran pendant l’envoi groupé d’invitations.
///
/// Bloque les interactions (et le retour arrière via [PopScope] côté écran).
class MemberInviteProgressOverlay extends StatefulWidget {
  const MemberInviteProgressOverlay({
    super.key,
    required this.completedCount,
    required this.totalCount,
    this.currentMemberName,
    this.phaseLabel,
  });

  /// Nombre d’e-mails déjà traités (0 → total).
  final int completedCount;

  /// Nombre total d’e-mails à envoyer.
  final int totalCount;

  /// Nom du membre en cours d’envoi (optionnel).
  final String? currentMemberName;

  /// Libellé de phase (préparation / envoi).
  final String? phaseLabel;

  @override
  State<MemberInviteProgressOverlay> createState() =>
      _MemberInviteProgressOverlayState();
}

class _MemberInviteProgressOverlayState
    extends State<MemberInviteProgressOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _spinController;

  @override
  void initState() {
    super.initState();
    _spinController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _spinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.totalCount <= 0 ? 1 : widget.totalCount;
    final progress = (widget.completedCount / total).clamp(0.0, 1.0);
    final theme = Theme.of(context).textTheme;
    final phaseLabel =
        widget.phaseLabel ?? AppCopy.members.inviteSendingPhase;

    return Material(
      color: ViroColors.scaffold.withValues(alpha: 0.94),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.xl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              RotationTransition(
                turns: _spinController,
                child: const ViroLogoMark(height: 72),
              ),
              const SizedBox(height: ViroSpacing.xl),
              Text(
                phaseLabel,
                textAlign: TextAlign.center,
                style: theme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: ViroColors.primary800,
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              Text(
                widget.currentMemberName != null &&
                        widget.currentMemberName!.trim().isNotEmpty
                    ? widget.currentMemberName!
                    : AppCopy.members.pleaseWait,
                textAlign: TextAlign.center,
                style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
              ),
              const SizedBox(height: ViroSpacing.lg),
              ClipRRect(
                borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
                child: LinearProgressIndicator(
                  value: widget.totalCount == 0 ? null : progress,
                  minHeight: 10,
                  backgroundColor: ViroColors.gray200,
                  color: ViroColors.primary600,
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              Text(
                widget.totalCount == 0
                    ? AppCopy.members.preparing
                    : '${widget.completedCount} / ${widget.totalCount}',
                style: theme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: ViroColors.primary800,
                ),
              ),
              const SizedBox(height: ViroSpacing.md),
              Text(
                AppCopy.members.stayOnScreenDuringSend,
                textAlign: TextAlign.center,
                style: theme.bodySmall?.copyWith(color: ViroColors.gray400),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
