import 'dart:async';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

enum _InviteEmailFeedback { idle, loading, success, error }

/// Variante visuelle du bouton d’envoi d’invitation par e-mail.
enum InviteEmailButtonVariant { primary, ghost }

/// Bouton d’envoi d’invitation e-mail avec feedback :
/// loader → succès 5 s / erreur 2 s (aligné portail).
class InviteEmailButton extends StatefulWidget {
  const InviteEmailButton({
    super.key,
    required this.onSend,
    this.disabled = false,
    this.variant = InviteEmailButtonVariant.primary,
  });

  /// Envoie l’invitation ; retourne `true` en cas de succès.
  final Future<bool> Function() onSend;
  final bool disabled;
  final InviteEmailButtonVariant variant;

  @override
  State<InviteEmailButton> createState() => _InviteEmailButtonState();
}

class _InviteEmailButtonState extends State<InviteEmailButton> {
  static const _successResetMs = 5000;
  static const _errorResetMs = 2000;

  _InviteEmailFeedback _feedback = _InviteEmailFeedback.idle;
  Timer? _resetTimer;

  @override
  void dispose() {
    _resetTimer?.cancel();
    super.dispose();
  }

  void _scheduleReset(int milliseconds) {
    _resetTimer?.cancel();
    _resetTimer = Timer(Duration(milliseconds: milliseconds), () {
      if (!mounted) return;
      setState(() => _feedback = _InviteEmailFeedback.idle);
    });
  }

  Future<void> _handlePress() async {
    if (widget.disabled || _feedback != _InviteEmailFeedback.idle) return;

    setState(() => _feedback = _InviteEmailFeedback.loading);
    try {
      final success = await widget.onSend();
      if (!mounted) return;
      if (success) {
        setState(() => _feedback = _InviteEmailFeedback.success);
        _scheduleReset(_successResetMs);
      } else {
        setState(() => _feedback = _InviteEmailFeedback.error);
        _scheduleReset(_errorResetMs);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _feedback = _InviteEmailFeedback.error);
      _scheduleReset(_errorResetMs);
    }
  }

  String get _idleLabel => widget.variant == InviteEmailButtonVariant.ghost
      ? 'Envoyer'
      : 'Envoyer l\'invitation';

  String get _label {
    return switch (_feedback) {
      _InviteEmailFeedback.loading => 'Envoi…',
      _InviteEmailFeedback.success => 'Envoyée',
      _InviteEmailFeedback.error => 'Échec',
      _InviteEmailFeedback.idle => _idleLabel,
    };
  }

  bool get _isLocked => _feedback != _InviteEmailFeedback.idle;

  Color? _backgroundColor(BuildContext context) {
    return switch (_feedback) {
      _InviteEmailFeedback.success => ViroColors.success,
      _InviteEmailFeedback.error => ViroColors.error,
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = theme.colorScheme.primary;
    final onAccent = theme.colorScheme.onPrimary;
    final backgroundColor = _backgroundColor(context);
    final isGhost = widget.variant == InviteEmailButtonVariant.ghost;

    final child = Row(
      mainAxisSize: isGhost ? MainAxisSize.min : MainAxisSize.max,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (_feedback == _InviteEmailFeedback.loading)
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: isGhost ? accent : onAccent,
            ),
          )
        else if (_feedback == _InviteEmailFeedback.success)
          ViroIcon(ViroIcons.check, size: 18, color: onAccent)
        else if (_feedback == _InviteEmailFeedback.error)
          ViroIcon(ViroIcons.close, size: 18, color: onAccent)
        else
          ViroIcon(
            ViroIcons.envelope,
            size: 18,
            color: isGhost ? accent : onAccent,
          ),
        const SizedBox(width: ViroSpacing.sm),
        Text(
          _label,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: backgroundColor != null
                ? onAccent
                : (isGhost ? accent : onAccent),
          ),
        ),
      ],
    );

    if (isGhost) {
      return TextButton(
        onPressed:
            widget.disabled || _isLocked ? null : () => _handlePress(),
        style: TextButton.styleFrom(
          foregroundColor: accent,
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.sm,
            vertical: ViroSpacing.xs,
          ),
          minimumSize: const Size(0, ViroSpacing.minTouchTarget),
        ),
        child: child,
      );
    }

    return SizedBox(
      width: double.infinity,
      height: ViroSpacing.buttonHeightLarge,
      child: ElevatedButton(
        onPressed:
            widget.disabled || _isLocked ? null : () => _handlePress(),
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor ?? accent,
          foregroundColor: onAccent,
        ),
        child: child,
      ),
    );
  }
}
