import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/club/widgets/club_context_avatar.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Sélecteur de clubs flottant en bas (logos + ajout + chat, sans bandeau).
class ClubSelectorBar extends ConsumerWidget {
  const ClubSelectorBar({
    super.key,
    required this.clubs,
    required this.pendingByClub,
    this.onAddClub,
    this.onOpenChat,
  });

  final List<UserClubEntry> clubs;
  final Map<String, int> pendingByClub;
  final VoidCallback? onAddClub;

  /// Ouverture chat — reçoit le centre global de la bulle pour l’anim d’expand.
  final void Function(Offset bubbleOrigin)? onOpenChat;

  /// Hauteur utile des logos (hors safe area bas).
  static const double barHeight = 80;
  static const double _logoSize = 44;
  static const double _addButtonSize = 28;
  static const double _chatButtonSize = 48;

  /// Espace à laisser en bas du body pour que le contenu ne passe pas sous les boutons.
  static double bottomClearance(BuildContext context) =>
      barHeight + MediaQuery.paddingOf(context).bottom;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chatUnread = onOpenChat != null
        ? ref.watch(chatTotalUnreadProvider)
        : 0;
    final items = clubs.map((entry) {
      final club = entry.club;
      final pending = pendingByClub[club.id] ?? 0;
      // Identité club (emoji / logo + bordure) même en mode parent-only :
      // l’avatar enfant ne remplace pas le sélecteur de clubs.
      return _ClubBarItem(
        label: _shortName(club.name),
        club: club,
        role: viroRoleForClubSession(
          memberRole: entry.membership?.role,
          hasFamilyLinks: entry.hasFamilyLinks,
        ),
        accentColor: clubAccentColor(
          brandColorHex: club.brandColorHex,
          clubId: club.id,
        ),
        badgeCount: pending > 0 ? pending : null,
        onTap: () => context.push(AppRoutes.clubDetailPath(club.id)),
      );
    }).toList();

    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return SizedBox(
      height: barHeight + bottomInset,
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: Stack(
          children: [
            Positioned.fill(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  // Padding symétrique : le centrage ignore l’icône chat
                  // (superposée à droite via Positioned).
                  const horizontalPad = ViroSpacing.screenHorizontal;
                  return SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(
                      horizontal: horizontalPad,
                    ),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minWidth: constraints.maxWidth - 2 * horizontalPad,
                        minHeight: constraints.maxHeight,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          ...items,
                          if (onAddClub != null)
                            _AddClubBarItem(onTap: onAddClub!),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            if (onOpenChat != null)
              Positioned(
                right: ViroSpacing.screenHorizontal,
                top: 0,
                bottom: 0,
                child: Center(
                  child: _ChatBarItem(
                    badgeCount: chatUnread > 0 ? chatUnread : null,
                    onTap: onOpenChat!,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _shortName(String name) {
    if (name.length <= 12) return name;
    return '${name.substring(0, 10)}…';
  }
}

class _AddClubBarItem extends StatelessWidget {
  const _AddClubBarItem({required this.onTap});

  final VoidCallback onTap;

  static const double _size = ClubSelectorBar._addButtonSize;

  @override
  Widget build(BuildContext context) {
    // Padding gauche réduit + emprise = taille du + : évite le trou
    // visuel dû à un petit cercle centré dans un slot logo.
    return Padding(
      padding: const EdgeInsets.only(
        left: ViroSpacing.xs,
        right: ViroSpacing.sm / 2,
      ),
      child: Semantics(
        button: true,
        label: AppCopy.home.addClub,
        child: GestureDetector(
          onTap: onTap,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: _size,
                height: ClubSelectorBar._logoSize,
                child: Center(
                  child: Container(
                    width: _size,
                    height: _size,
                    decoration: BoxDecoration(
                      color: ViroColors.primary50,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: ViroColors.primary200,
                        width: 1,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: ViroIcon(
                      ViroIcons.add,
                      size: 14,
                      color: ViroColors.primary600,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              const SizedBox(width: _size, height: 14),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChatBarItem extends StatelessWidget {
  const _ChatBarItem({required this.onTap, this.badgeCount});

  final void Function(Offset bubbleOrigin) onTap;
  final int? badgeCount;

  static const double _size = ClubSelectorBar._chatButtonSize;

  /// Relève le centre global de la bulle puis notifie [onTap].
  void _handleTap(BuildContext context) {
    final box = context.findRenderObject() as RenderBox?;
    final origin = box != null && box.hasSize
        ? box.localToGlobal(box.size.center(Offset.zero))
        : Offset.zero;
    onTap(origin);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final hasBadge = badgeCount != null;

    return Semantics(
      button: true,
      label: AppCopy.chat.chatEntry,
      child: ViroPressable(
        onTap: () => _handleTap(context),
        borderRadius: BorderRadius.circular(_size / 2),
        floating: false,
        minSize: _size,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            SizedBox(
              width: _size,
              height: _size,
              child: CustomPaint(
                painter: const _ChatCirclePainter(),
                child: Center(
                  child: ViroIcon(
                    ViroIcons.chatFill,
                    size: 22,
                    color: ViroColors.primary600,
                  ),
                ),
              ),
            ),
            if (hasBadge)
              Positioned(
                top: -2,
                right: -2,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: ViroColors.error,
                    shape: BoxShape.circle,
                    boxShadow: ViroMotion.floatingShadow(
                      opacity: 0.18,
                      blur: 8,
                      y: 2,
                    ),
                  ),
                  constraints: const BoxConstraints(
                    minWidth: 18,
                    minHeight: 18,
                  ),
                  child: Text(
                    badgeCount! > 99 ? '99+' : '$badgeCount',
                    textAlign: TextAlign.center,
                    style: theme.labelSmall?.copyWith(
                      color: ViroColors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Peint le pastille ronde du bouton chat (ombre + dégradé + contour).
class _ChatCirclePainter extends CustomPainter {
  const _ChatCirclePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.shortestSide / 2 - 1;

    canvas.drawCircle(
      center.translate(0, 3),
      radius,
      Paint()
        ..color = ViroColors.primary900.withValues(alpha: 0.12)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
    canvas.drawCircle(
      center.translate(0, 1),
      radius,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.04)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );

    final bounds = Rect.fromCircle(center: center, radius: radius);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [ViroColors.white, ViroColors.primary50],
        ).createShader(bounds),
    );
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.25
        ..color = ViroColors.primary100,
    );
  }

  @override
  bool shouldRepaint(covariant _ChatCirclePainter oldDelegate) => false;
}

class _ClubBarItem extends StatelessWidget {
  const _ClubBarItem({
    required this.label,
    required this.club,
    required this.onTap,
    this.role,
    this.accentColor,
    this.badgeCount,
  });

  final String label;
  final Club club;
  final VoidCallback onTap;
  final ViroRole? role;
  final Color? accentColor;
  final int? badgeCount;

  static const double _logoSize = ClubSelectorBar._logoSize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final color = accentColor ?? ViroColors.primary600;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.sm / 2),
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: ViroMotion.floatingShadow(
                      opacity: 0.16,
                      blur: 12,
                      y: 4,
                    ),
                  ),
                  child: ClubContextAvatar(
                    club: club,
                    accentColor: color,
                    size: _logoSize,
                    borderRadius: _logoSize / 2,
                  ),
                ),
                if (badgeCount != null)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: ViroColors.error,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 18,
                        minHeight: 18,
                      ),
                      child: Text(
                        '$badgeCount',
                        textAlign: TextAlign.center,
                        style: theme.labelSmall?.copyWith(
                          color: ViroColors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                if (role != null)
                  Positioned(
                    bottom: -2,
                    right: -2,
                    child: ViroRoleSatelliteBadge(role: role!),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            SizedBox(
              width: 52,
              height: 14,
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.labelSmall?.copyWith(
                  fontSize: 10,
                  height: 1.1,
                  color: ViroColors.gray600,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
