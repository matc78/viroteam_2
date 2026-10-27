import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
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
    final chatButton = onOpenChat != null
        ? _ChatBarItem(
            badgeCount: chatUnread > 0 ? chatUnread : null,
            onTap: onOpenChat!,
          )
        : null;

    // Un seul club : le logo seul passe inaperçu à côté du +, on affiche
    // une pastille large (logo + nom) pour rendre l’accès au club évident.
    if (items.length == 1) {
      return _SingleClubBar(
        clubItem: items.single,
        bottomInset: bottomInset,
        onAddClub: onAddClub,
        chatButton: chatButton,
      );
    }

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
            if (chatButton != null)
              Positioned(
                right: ViroSpacing.screenHorizontal,
                top: 0,
                bottom: 0,
                child: Center(child: chatButton),
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

/// Barre du bas quand l’utilisateur n’a qu’un club : pastille club large,
/// centrée en réservant la place du bouton chat de chaque côté.
class _SingleClubBar extends StatelessWidget {
  const _SingleClubBar({
    required this.clubItem,
    required this.bottomInset,
    this.onAddClub,
    this.chatButton,
  });

  final _ClubBarItem clubItem;
  final double bottomInset;
  final VoidCallback? onAddClub;
  final Widget? chatButton;

  @override
  Widget build(BuildContext context) {
    // Marge symétrique : la pastille reste centrée sans passer sous le chat.
    final sidePad =
        ViroSpacing.screenHorizontal +
        (chatButton != null
            ? ClubSelectorBar._chatButtonSize + ViroSpacing.sm
            : 0);

    return SizedBox(
      height: ClubSelectorBar.barHeight + bottomInset,
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: Stack(
          children: [
            Positioned.fill(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: sidePad),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(child: _ClubBarHighlightItem(item: clubItem)),
                    if (onAddClub != null)
                      _AddClubBarItem(onTap: onAddClub!, showLabelSpace: false),
                  ],
                ),
              ),
            ),
            if (chatButton != null)
              Positioned(
                right: ViroSpacing.screenHorizontal,
                top: 0,
                bottom: 0,
                child: Center(child: chatButton),
              ),
          ],
        ),
      ),
    );
  }
}

/// Pastille large d’accès au club (logo, nom complet, invite « Ouvrir »).
class _ClubBarHighlightItem extends StatelessWidget {
  const _ClubBarHighlightItem({required this.item});

  final _ClubBarItem item;

  static const double _height = 60;
  static const double _avatarSize = 44;
  static const double _maxWidth = 280;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final color = item.accentColor ?? palette.accentFill;
    final readableColor = palette.readableAccent(color);
    final badgeCount = item.badgeCount;

    final semanticParts = <String>[
      AppCopy.home.openClub,
      item.club.name,
      if (badgeCount != null && badgeCount > 0)
        '$badgeCount ${AppCopy.common.pending}',
    ];

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: _maxWidth),
      child: ViroPressable(
        onTap: item.onTap,
        floating: false,
        borderRadius: BorderRadius.circular(_height / 2),
        label: semanticParts.join(', '),
        child: Container(
          height: _height,
          padding: const EdgeInsets.only(
            left: (_height - _avatarSize) / 2,
            right: ViroSpacing.md,
          ),
          decoration: BoxDecoration(
            color: palette.surfaceCard,
            borderRadius: BorderRadius.circular(_height / 2),
            border: Border.all(color: readableColor, width: 1.5),
            boxShadow: [
              ...ViroMotion.floatingShadow(
                palette,
                opacity: 0.16,
                blur: 12,
                y: 4,
              ),
              ...palette.neonBoxGlow(readableColor, blur: 10, alpha: 0.28),
            ],
          ),
          child: ExcludeSemantics(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ClubBarAvatar(
                  club: item.club,
                  accentColor: color,
                  size: _avatarSize,
                  role: item.role,
                  badgeCount: badgeCount,
                  neonGlow: false,
                ),
                const SizedBox(width: ViroSpacing.sm),
                Flexible(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.club.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.titleSmall?.copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        AppCopy.home.openClub,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.labelSmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: ViroSpacing.sm),
                ViroIcon(
                  ViroIcons.chevronRight,
                  size: 18,
                  color: readableColor,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AddClubBarItem extends StatelessWidget {
  const _AddClubBarItem({required this.onTap, this.showLabelSpace = true});

  final VoidCallback onTap;

  /// Réserve la hauteur du libellé des logos (barre multi-clubs) pour
  /// aligner le + sur les avatars ; inutile à côté de la pastille mono-club.
  final bool showLabelSpace;

  static const double _size = ClubSelectorBar._addButtonSize;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
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
                      color: palette.accentSofter,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: palette.accentSoft,
                        width: 1,
                      ),
                      boxShadow: ViroMotion.floatingShadow(
                        palette,
                        opacity: 0.1,
                        blur: 8,
                        y: 2,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: ViroIcon(
                      ViroIcons.add,
                      size: 14,
                      color: palette.accent,
                    ),
                  ),
                ),
              ),
              if (showLabelSpace) ...[
                const SizedBox(height: 4),
                const SizedBox(width: _size, height: 14),
              ],
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
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final hasBadge = badgeCount != null;

    return ViroPressable(
      onTap: () => _handleTap(context),
      borderRadius: BorderRadius.circular(_size / 2),
      floating: false,
      minSize: _size,
      label: AppCopy.chat.chatEntryWithUnread(badgeCount ?? 0),
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: _size,
            height: _size,
            child: CustomPaint(
              painter: _ChatCirclePainter(palette),
              child: Center(
                child: ViroIcon(
                  ViroIcons.chatFill,
                  size: 22,
                  color: palette.accent,
                ),
              ),
            ),
          ),
          if (hasBadge)
            Positioned(
              top: -2,
              right: -2,
              child: ExcludeSemantics(
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: ViroColors.error,
                    shape: BoxShape.circle,
                    boxShadow: ViroMotion.floatingShadow(
                      context.viroPalette,
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
            ),
        ],
      ),
    );
  }
}

/// Peint le pastille ronde du bouton chat (ombre + dégradé + contour).
class _ChatCirclePainter extends CustomPainter {
  const _ChatCirclePainter(this.palette);

  final ViroPalette palette;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.shortestSide / 2 - 1;

    canvas.drawCircle(
      center.translate(0, 3),
      radius,
      Paint()
        ..color = palette.shadowTint.withValues(
          alpha: 0.12 * palette.shadowStrength,
        )
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
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [palette.surfaceCard, palette.accentSofter],
        ).createShader(bounds),
    );
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.25
        ..color = palette.accentSoft,
    );
  }

  @override
  bool shouldRepaint(covariant _ChatCirclePainter oldDelegate) =>
      oldDelegate.palette != palette;
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
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final color = accentColor ?? palette.accentFill;

    final semanticParts = <String>[
      club.name,
      if (badgeCount != null && badgeCount! > 0)
        '$badgeCount ${AppCopy.common.pending}',
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.sm / 2),
      child: Semantics(
        button: true,
        label: semanticParts.join(', '),
        child: GestureDetector(
          onTap: onTap,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _ClubBarAvatar(
                club: club,
                accentColor: color,
                size: _logoSize,
                role: role,
                badgeCount: badgeCount,
              ),
              const SizedBox(height: 4),
              ExcludeSemantics(
                child: SizedBox(
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
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Logo club rond avec ombre, pastille d’attente et badge de rôle.
class _ClubBarAvatar extends StatelessWidget {
  const _ClubBarAvatar({
    required this.club,
    required this.accentColor,
    required this.size,
    this.role,
    this.badgeCount,
    this.neonGlow = true,
  });

  final Club club;
  final Color accentColor;
  final double size;
  final ViroRole? role;
  final int? badgeCount;

  /// Halo néon couleur club (barre multi-clubs). Désactivé dans la pastille
  /// mono-club, déjà bordée / glowée au niveau du conteneur.
  final bool neonGlow;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final readable = palette.readableAccent(accentColor);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              ...ViroMotion.floatingShadow(
                palette,
                opacity: 0.18,
                blur: 12,
                y: 4,
              ),
              if (neonGlow)
                ...palette.neonBoxGlow(readable, blur: 10, alpha: 0.28),
            ],
          ),
          child: ClubContextAvatar(
            club: club,
            accentColor: readable,
            size: size,
            borderRadius: size / 2,
            enableZoom: false,
          ),
        ),
        if (badgeCount != null)
          Positioned(
            top: -2,
            right: -2,
            child: ExcludeSemantics(
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: ViroColors.error,
                  shape: BoxShape.circle,
                ),
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
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
          ),
        if (role != null)
          Positioned(
            bottom: -2,
            right: -2,
            child: ViroRoleSatelliteBadge(role: role!),
          ),
      ],
    );
  }
}
