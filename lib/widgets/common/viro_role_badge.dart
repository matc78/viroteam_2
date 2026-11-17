import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Badges affichables en UI.
///
/// Admin / Entraîneur / Joueur / Membre se dérivent de la fiche (droit
/// `admin`, équipes entraînées, effectif : voir [MemberBadge]).
/// [ViroRole.parent] = relation parent↔enfant
/// ([ProjectConfig.parentLinksField]), pas un droit.
enum ViroRole { player, coach, parent, admin, member }

/// Badge UI d'un [MemberBadge].
ViroRole viroRoleFromBadge(MemberBadge badge) => switch (badge) {
      MemberBadge.admin => ViroRole.admin,
      MemberBadge.coach => ViroRole.coach,
      MemberBadge.player => ViroRole.player,
      MemberBadge.member => ViroRole.member,
    };

/// Badge principal d'une fiche (ou de son profil de conversation), ou
/// `null` si l'identifiant de profil est inconnu.
ViroRole? viroRoleForMember(ClubMember member) =>
    viroRoleFromChatSenderRole(member.chatBadgeId);

/// Badge affiché pour un club en session (listes de clubs).
///
/// [memberBadge] = badge principal de `members/{uid}` (`null` sans fiche) ;
/// [hasFamilyLinks] = liens parent actifs. Une fiche au seul badge Membre qui
/// suit un enfant affiche Parent, plus parlant.
ViroRole? viroRoleForClubSession({
  MemberBadge? memberBadge,
  bool hasFamilyLinks = false,
}) {
  if (memberBadge != null && memberBadge != MemberBadge.member) {
    return viroRoleFromBadge(memberBadge);
  }
  if (hasFamilyLinks) return ViroRole.parent;
  if (memberBadge != null) return ViroRole.member;
  return null;
}

/// Badges d'un club du sélecteur : badges de la fiche ([memberBadges],
/// `null` sans fiche), Parent à la place d'un seul badge Membre quand le
/// compte suit un enfant ([hasFamilyLinks]).
List<ViroRole> viroRolesForClubSelector({
  List<MemberBadge>? memberBadges,
  bool hasFamilyLinks = false,
}) {
  final onlyMember = memberBadges == null ||
      memberBadges.every((badge) => badge == MemberBadge.member);
  if (onlyMember && hasFamilyLinks) return const [ViroRole.parent];
  if (memberBadges == null) return const [];
  return [for (final badge in memberBadges) viroRoleFromBadge(badge)];
}

/// Badge d'un identifiant de chat ([ChatBadgeIds]), ou `null` si inconnu.
ViroRole? viroRoleFromChatSenderRole(String role) => switch (role) {
      'admin' => ViroRole.admin,
      'coach' => ViroRole.coach,
      'player' => ViroRole.player,
      ChatBadgeIds.member => ViroRole.member,
      ChatBadgeIds.parent => ViroRole.parent,
      _ => null,
    };

/// Couleur de bordure des bulles de discussion selon le rôle de l’expéditeur
/// (aucune pour un simple membre).
Color? chatBubbleBorderForRole(String role) {
  final viroRole = viroRoleFromChatSenderRole(role);
  if (viroRole == null || viroRole == ViroRole.member) return null;
  return RoleBadgeVisual.forRole(viroRole).end;
}

/// Badge de rôle coloré (joueur, entraîneur, parent, admin) ; Membre en
/// aplat gris, sans dégradé ni halo.
class ViroRoleBadge extends StatelessWidget {
  const ViroRoleBadge({
    super.key,
    required this.role,
    this.compact = false,
    this.iconOnly = false,
  });

  final ViroRole role;
  final bool compact;

  /// Affiche uniquement l’icône (ex. meta inbox chat, style portail).
  final bool iconOnly;

  @override
  Widget build(BuildContext context) {
    final style = RoleBadgeVisual.forRole(role);
    final label = RoleBadgeVisual.labelFor(role);
    final height = compact ? 28.0 : 36.0;
    final iconSize = compact ? 14.0 : 16.0;
    final fontSize = compact ? 11.0 : 13.0;
    final iconBox = compact ? 20.0 : 24.0;

    if (iconOnly) {
      final pad = compact ? 2.0 : 4.0;
      final box = compact ? 14.0 : 18.0;
      final glyph = compact ? 9.0 : 12.0;
      return Container(
        padding: EdgeInsets.all(pad),
        decoration: BoxDecoration(
          color: style.flat ? style.start : null,
          gradient: style.gradient,
          borderRadius: BorderRadius.circular(compact ? 6 : 8),
          boxShadow: style.flat
              ? null
              : [
                  BoxShadow(
                    color: style.end.withValues(alpha: 0.4),
                    blurRadius: compact ? 6 : 10,
                    offset: Offset(0, compact ? 2 : 3),
                  ),
                ],
        ),
        child: Container(
          width: box,
          height: box,
          decoration: BoxDecoration(
            color: ViroColors.roleBadgeIconBg,
            borderRadius: BorderRadius.circular(compact ? 3.5 : 5),
          ),
          alignment: Alignment.center,
          child: ViroIcon(
            style.icon,
            size: glyph,
            color: style.foreground,
          ),
        ),
      );
    }

    return Container(
      height: height,
      padding: EdgeInsets.only(
        left: compact ? 6 : 8,
        right: compact ? 10 : 12,
      ),
      decoration: BoxDecoration(
        color: style.flat ? style.start : null,
        gradient: style.gradient,
        borderRadius: BorderRadius.circular(compact ? 8 : 10),
        boxShadow: style.flat
            ? null
            : [
                BoxShadow(
                  color: style.end.withValues(alpha: 0.45),
                  blurRadius: compact ? 8 : 12,
                  offset: Offset(0, compact ? 3 : 4),
                ),
              ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: iconBox,
            height: iconBox,
            decoration: BoxDecoration(
              color: ViroColors.roleBadgeIconBg,
              borderRadius: BorderRadius.circular(6),
            ),
            alignment: Alignment.center,
            child: ViroIcon(
              style.icon,
              size: iconSize,
              color: style.foreground,
            ),
          ),
          SizedBox(width: compact ? 6 : 8),
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              color: style.foreground,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// Badge satellite (icône seule) — ancré sur un avatar / logo de club.
class ViroRoleSatelliteBadge extends StatelessWidget {
  const ViroRoleSatelliteBadge({super.key, required this.role});

  final ViroRole role;

  static const double size = 22;

  @override
  Widget build(BuildContext context) {
    final style = RoleBadgeVisual.forRole(role);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: style.flat ? style.start : null,
        gradient: style.gradient,
        shape: BoxShape.circle,
        // Anneau de découpe : couleur de la carte sous l'avatar.
        border: Border.all(color: context.viroPalette.surfaceCard, width: 2),
        boxShadow: style.flat
            ? null
            : [
                BoxShadow(
                  color: style.end.withValues(alpha: 0.4),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      alignment: Alignment.center,
      child: ViroIcon(
        style.icon,
        size: 12,
        color: style.foreground,
      ),
    );
  }
}

abstract final class RoleBadgeVisual {
  static String labelFor(ViroRole role) => switch (role) {
        ViroRole.player => AppCopy.common.rolePlayer,
        ViroRole.coach => AppCopy.common.roleCoach,
        ViroRole.parent => AppCopy.common.roleParent,
        ViroRole.admin => AppCopy.common.roleAdmin,
        ViroRole.member => AppCopy.common.roleMember,
      };

  static RoleBadgeStyle forRole(ViroRole role) => switch (role) {
        ViroRole.player => RoleBadgeStyle(
            start: ViroColors.playerBadgeStart,
            end: ViroColors.playerBadgeEnd,
            icon: ViroIcons.rolePlayer,
          ),
        ViroRole.coach => RoleBadgeStyle(
            start: ViroColors.coachBadgeStart,
            end: ViroColors.coachBadgeEnd,
            icon: ViroIcons.roleCoach,
          ),
        ViroRole.parent => RoleBadgeStyle(
            start: ViroColors.parentBadgeStart,
            end: ViroColors.parentBadgeEnd,
            icon: ViroIcons.roleParent,
          ),
        ViroRole.admin => RoleBadgeStyle(
            start: ViroColors.adminBadgeStart,
            end: ViroColors.adminBadgeEnd,
            icon: ViroIcons.roleAdmin,
          ),
        ViroRole.member => RoleBadgeStyle(
            start: ViroColors.memberBadgeBackground,
            end: ViroColors.memberBadgeBackground,
            icon: ViroIcons.roleMember,
            foreground: ViroColors.memberBadgeText,
            flat: true,
          ),
      };
}

class RoleBadgeStyle {
  const RoleBadgeStyle({
    required this.start,
    required this.end,
    required this.icon,
    this.foreground = ViroColors.roleBadgeText,
    this.flat = false,
  });

  final Color start;
  final Color end;
  final IconData icon;

  /// Couleur du texte et de l'icône.
  final Color foreground;

  /// Aplat simple ([start]), sans dégradé ni halo (badge Membre).
  final bool flat;

  /// Dégradé du badge, ou `null` pour un aplat.
  Gradient? get gradient => flat
      ? null
      : LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [start, end],
        );
}
