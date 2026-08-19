import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

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

/// Bouton outlined avec le logo Google officiel.
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
    final theme = Theme.of(context).textTheme;

    return SizedBox(
      width: double.infinity,
      height: ViroSpacing.buttonHeightLarge,
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: ViroColors.white,
          side: BorderSide(color: ViroColors.gray200),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
          ),
        ),
        child: isLoading
            ? const SizedBox(
                height: 22,
                width: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const _GoogleLogo(size: 20),
                  const SizedBox(width: ViroSpacing.sm),
                  Text(
                    'Continuer avec Google',
                    style: theme.labelLarge?.copyWith(
                      color: ViroColors.gray900,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// Logo Google « G » multicolore peint via Canvas.
class _GoogleLogo extends StatelessWidget {
  const _GoogleLogo({this.size = 24});
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _GoogleLogoPainter()),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  static const _red = Color(0xFFEA4335);
  static const _yellow = Color(0xFFFBBC05);
  static const _green = Color(0xFF34A853);
  static const _blue = Color(0xFF4285F4);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final center = Offset(s / 2, s / 2);
    final outerRadius = s / 2;
    final innerRadius = s * 0.28;
    final strokeWidth = outerRadius - innerRadius;
    final arcRadius = (outerRadius + innerRadius) / 2;

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.butt;

    final rect = Rect.fromCircle(center: center, radius: arcRadius);

    // Blue (right, 315° to 45° → -45° to 45° in radians)
    paint.color = _blue;
    canvas.drawArc(rect, -0.78, 1.57, false, paint);

    // Green (bottom, 45° to 135°)
    paint.color = _green;
    canvas.drawArc(rect, 0.78, 1.57, false, paint);

    // Yellow (left, 135° to 225°)
    paint.color = _yellow;
    canvas.drawArc(rect, 2.36, 1.57, false, paint);

    // Red (top, 225° to 315°)
    paint.color = _red;
    canvas.drawArc(rect, 3.93, 1.57, false, paint);

    // Blue horizontal bar (the "notch" of the G)
    final barPaint = Paint()..color = _blue;
    final barTop = center.dy - strokeWidth / 2;
    canvas.drawRect(
      Rect.fromLTWH(center.dx - s * 0.02, barTop, s * 0.52, strokeWidth),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
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
