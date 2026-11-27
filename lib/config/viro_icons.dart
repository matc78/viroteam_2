import 'package:flutter/material.dart';
import 'package:phosphoricons_flutter/phosphoricons_flutter.dart';

/// Icônes sémantiques ViroTeam — [Phosphor Icons](https://phosphoricons.com).
///
/// Utiliser [ViroIcon] dans l'UI, pas `Icons.*` ni `PhosphorIcon` directement
/// dans les écrans (sauf ce fichier).
abstract final class ViroIcons {
  // Navigation & chrome
  static IconData get menu => PhosphorIconsRegular.list;
  static IconData get settings => PhosphorIconsRegular.gear;
  static IconData get add => PhosphorIconsBold.plus;
  static IconData get arrowUp => PhosphorIconsRegular.arrowUp;
  static IconData get arrowDown => PhosphorIconsRegular.arrowDown;
  /// Flèches d’indication (hint scroll RSVP) — trait épais pour le contraste.
  static IconData get arrowUpBold => PhosphorIconsBold.arrowUp;
  static IconData get arrowDownBold => PhosphorIconsBold.arrowDown;
  static IconData get chevronRight => PhosphorIconsRegular.caretRight;
  static IconData get chevronLeft => PhosphorIconsRegular.caretLeft;
  static IconData get chevronDown => PhosphorIconsRegular.caretDown;
  static IconData get chevronUp => PhosphorIconsRegular.caretUp;
  static IconData get club => PhosphorIconsRegular.buildings;
  static IconData get close => PhosphorIconsRegular.x;
  static IconData get appUpdate => PhosphorIconsRegular.downloadSimple;

  /// Action à faire sur ordinateur (renvoi vers le portail web).
  static IconData get desktop => PhosphorIconsRegular.desktop;

  /// Import d’un fichier (liste de membres).
  static IconData get fileImport => PhosphorIconsRegular.fileArrowUp;

  // Lieux & planning
  static IconData get place => PhosphorIconsRegular.mapPin;
  static IconData get navigation => PhosphorIconsRegular.navigationArrow;
  static IconData get calendar => PhosphorIconsRegular.calendar;
  static IconData get clock => PhosphorIconsRegular.clock;

  // Sport & équipe
  static IconData get ball => PhosphorIconsFill.soccerBall;
  static IconData get trophy => PhosphorIconsFill.trophy;

  /// Coupe en contour : accès léger au classement (home, carte équipe).
  static IconData get trophyOutline => PhosphorIconsRegular.trophy;
  static IconData get refresh => PhosphorIconsRegular.arrowsClockwise;

  /// Match à domicile / à l'extérieur (parcours d'une équipe).
  static IconData get homeGame => PhosphorIconsFill.house;
  static IconData get awayGame => PhosphorIconsFill.van;
  static IconData get link => PhosphorIconsRegular.link;
  static IconData get linkBreak => PhosphorIconsRegular.linkBreak;
  static IconData get users => PhosphorIconsRegular.users;
  static IconData get whistle => PhosphorIconsRegular.megaphoneSimple;
  static IconData get chat => PhosphorIconsRegular.chatCircle;
  static IconData get chatFill => PhosphorIconsFill.chatCircle;
  static IconData get whatsapp => PhosphorIconsRegular.whatsappLogo;
  static IconData get send => PhosphorIconsRegular.paperPlaneTilt;
  static IconData get sendFill => PhosphorIconsFill.paperPlaneRight;
  static IconData get megaphone => PhosphorIconsRegular.megaphone;

  // Actions
  static IconData get edit => PhosphorIconsRegular.pencilSimple;
  static IconData get trash => PhosphorIconsRegular.trash;
  static IconData get check => PhosphorIconsBold.check;
  static IconData get checkCircle => PhosphorIconsFill.checkCircle;
  static IconData get radioOn => PhosphorIconsFill.radioButton;
  static IconData get radioOff => PhosphorIconsRegular.circle;
  static IconData get checkboxOn => PhosphorIconsFill.checkSquare;
  static IconData get checkboxOff => PhosphorIconsRegular.square;
  static IconData get xCircle => PhosphorIconsFill.xCircle;
  static IconData get search => PhosphorIconsRegular.magnifyingGlass;
  static IconData get copy => PhosphorIconsRegular.copy;
  static IconData get download => PhosphorIconsRegular.downloadSimple;
  static IconData get envelope => PhosphorIconsRegular.envelopeSimple;
  static IconData get moreVertical => PhosphorIconsRegular.dotsThreeVertical;
  static IconData get eye => PhosphorIconsRegular.eye;
  static IconData get eyeSlash => PhosphorIconsRegular.eyeSlash;
  static IconData get info => PhosphorIconsRegular.info;

  // Compte
  static IconData get user => PhosphorIconsRegular.user;
  /// Retirer quelqu'un d'un effectif (ligne de roster d'équipe).
  static IconData get userMinus => PhosphorIconsRegular.userMinus;
  /// Inviter dans une équipe (code d'invitation partagé).
  static IconData get userPlus => PhosphorIconsRegular.userPlus;
  static IconData get logout => PhosphorIconsRegular.signOut;
  static IconData get privacy => PhosphorIconsRegular.shieldCheck;
  static IconData get warning => PhosphorIconsRegular.warning;
  static IconData get bell => PhosphorIconsRegular.bell;
  static IconData get payments => PhosphorIconsRegular.currencyEur;
  static IconData get image => PhosphorIconsRegular.image;
  /// Agrandir une image (vignette tappable).
  static IconData get zoomIn => PhosphorIconsRegular.magnifyingGlassPlus;
  static IconData get themeLight => PhosphorIconsRegular.sun;
  static IconData get themeDark => PhosphorIconsRegular.moon;
  static IconData get themeSystem => PhosphorIconsRegular.deviceMobile;
  static IconData get camera => PhosphorIconsRegular.camera;
  static IconData get poll => PhosphorIconsRegular.chartBar;
  static IconData get analytics => PhosphorIconsRegular.chartLineUp;
  static IconData get smiley => PhosphorIconsRegular.smiley;
  static IconData get selectAll => PhosphorIconsRegular.selectionAll;
  static IconData get note => PhosphorIconsRegular.notePencil;
  static IconData get block => PhosphorIconsRegular.prohibit;
  static IconData get lock => PhosphorIconsRegular.lock;
  static IconData get personOutline => PhosphorIconsRegular.user;
  static IconData get groups => PhosphorIconsRegular.usersThree;
  static IconData get key => PhosphorIconsRegular.key;
  static IconData get google => PhosphorIconsFill.googleLogo;
  static IconData get share => PhosphorIconsRegular.shareNetwork;
  static IconData get calendarPlus => PhosphorIconsRegular.calendarPlus;
  /// Synchro du planning avec l'agenda du téléphone (distinct du « + »).
  static IconData get calendarSync => PhosphorIconsRegular.arrowsClockwise;
  /// Retour au jour courant dans un planning.
  static IconData get today => PhosphorIconsRegular.calendarDot;

  // Messagerie (menu conversation / actions)
  static IconData get mute => PhosphorIconsRegular.bellSlash;
  static IconData get favorite => PhosphorIconsRegular.heart;
  static IconData get favoriteFill => PhosphorIconsFill.heart;
  static IconData get pin => PhosphorIconsRegular.pushPin;
  static IconData get attachment => PhosphorIconsRegular.paperclip;
  static IconData get exportChat => PhosphorIconsRegular.downloadSimple;
  static IconData get clearChat => PhosphorIconsRegular.minusCircle;
  static IconData get selectMessages => PhosphorIconsRegular.checkSquare;
  /// Proxy « messages éphémères » (pas d’équivalent 1:1 WhatsApp dans Phosphor).
  static IconData get ephemeral => PhosphorIconsRegular.timer;
  /// Proxy « ajouter à une liste ».
  static IconData get addToList => PhosphorIconsRegular.listPlus;
  static IconData get leaveGroup => PhosphorIconsRegular.signOut;

  // Outils d’entraînement (préparation, retours, tableau blanc)
  static IconData get trainingPrep => PhosphorIconsRegular.clipboardText;
  static IconData get feedback => PhosphorIconsRegular.chatCircleText;
  static IconData get star => PhosphorIconsRegular.star;
  static IconData get starFill => PhosphorIconsFill.star;
  static IconData get starHalf => PhosphorIconsFill.starHalf;
  static IconData get dragHandle => PhosphorIconsRegular.dotsSixVertical;
  static IconData get boardArrow => PhosphorIconsRegular.arrowUpRight;
  static IconData get boardMove => PhosphorIconsRegular.handGrabbing;
  static IconData get boardBall => PhosphorIconsRegular.volleyball;
  static IconData get undo => PhosphorIconsRegular.arrowCounterClockwise;
  static IconData get eraser => PhosphorIconsRegular.eraser;

  // Rôles (badges)
  static IconData get rolePlayer => PhosphorIconsFill.soccerBall;
  static IconData get roleCoach => PhosphorIconsFill.megaphoneSimple;
  static IconData get roleParent => PhosphorIconsFill.usersThree;
  static IconData get roleAdmin => PhosphorIconsFill.shieldCheck;
  static IconData get roleMember => PhosphorIconsFill.user;
  static IconData get roleSparring => PhosphorIconsFill.handshake;

  /// Bascule joueur ↔ sparring (action sur une ligne d'effectif).
  static IconData get sparringToggle => PhosphorIconsRegular.handshake;

  /// Catalogue pour l'écran design system (groupé).
  static List<ViroIconCatalogGroup> get catalog => [
        ViroIconCatalogGroup(
          title: 'Navigation & chrome',
          icons: [
            ('menu', menu),
            ('settings', settings),
            ('add', add),
            ('arrowUp', arrowUp),
            ('arrowUpBold', arrowUpBold),
            ('arrowDownBold', arrowDownBold),
            ('chevronRight', chevronRight),
            ('chevronDown', chevronDown),
            ('club', club),
            ('close', close),
            ('appUpdate', appUpdate),
            ('desktop', desktop),
            ('fileImport', fileImport),
          ],
        ),
        ViroIconCatalogGroup(
          title: 'Lieux & planning',
          icons: [
            ('place', place),
            ('navigation', navigation),
            ('calendar', calendar),
            ('clock', clock),
          ],
        ),
        ViroIconCatalogGroup(
          title: 'Sport & équipe',
          icons: [
            ('ball', ball),
            ('trophy', trophy),
            ('trophyOutline', trophyOutline),
            ('refresh', refresh),
            ('link', link),
            ('linkBreak', linkBreak),
            ('users', users),
            ('whistle', whistle),
            ('chat', chat),
            ('chatFill', chatFill),
            ('whatsapp', whatsapp),
            ('send', send),
            ('megaphone', megaphone),
          ],
        ),
        ViroIconCatalogGroup(
          title: 'Actions',
          icons: [
            ('edit', edit),
            ('trash', trash),
            ('check', check),
            ('checkCircle', checkCircle),
            ('xCircle', xCircle),
            ('search', search),
            ('copy', copy),
            ('download', download),
            ('info', info),
            ('poll', poll),
          ],
        ),
        ViroIconCatalogGroup(
          title: 'Messagerie',
          icons: [
            ('mute', mute),
            ('favorite', favorite),
            ('favoriteFill', favoriteFill),
            ('pin', pin),
            ('attachment', attachment),
            ('exportChat', exportChat),
            ('clearChat', clearChat),
            ('selectMessages', selectMessages),
            ('ephemeral', ephemeral),
            ('addToList', addToList),
            ('leaveGroup', leaveGroup),
            ('block', block),
            ('lock', lock),
          ],
        ),
        ViroIconCatalogGroup(
          title: 'Compte',
          icons: [
            ('user', user),
            ('logout', logout),
            ('privacy', privacy),
            ('warning', warning),
            ('bell', bell),
            ('image', image),
            ('themeLight', themeLight),
            ('themeDark', themeDark),
            ('themeSystem', themeSystem),
            ('camera', camera),
            ('selectAll', selectAll),
            ('note', note),
            ('analytics', analytics),
          ],
        ),
        ViroIconCatalogGroup(
          title: 'Entraînement',
          icons: [
            ('trainingPrep', trainingPrep),
            ('feedback', feedback),
            ('star', star),
            ('starFill', starFill),
            ('starHalf', starHalf),
            ('dragHandle', dragHandle),
            ('boardArrow', boardArrow),
            ('boardMove', boardMove),
            ('boardBall', boardBall),
            ('undo', undo),
            ('eraser', eraser),
          ],
        ),
        ViroIconCatalogGroup(
          title: 'Rôles (badges)',
          icons: [
            ('rolePlayer', rolePlayer),
            ('roleCoach', roleCoach),
            ('roleParent', roleParent),
            ('roleAdmin', roleAdmin),
            ('roleMember', roleMember),
            ('roleSparring', roleSparring),
            ('sparringToggle', sparringToggle),
          ],
        ),
      ];
}

/// Entrée du catalogue d'icônes (aperçu thème).
class ViroIconCatalogGroup {
  const ViroIconCatalogGroup({
    required this.title,
    required this.icons,
  });

  final String title;
  final List<(String name, IconData icon)> icons;
}

/// Rendu standard des icônes Phosphor dans l'app.
///
/// - Icône **décorative** (à côté d’un texte déjà lisible) : laisser
///   [semanticLabel] à `null` (exclue du bruit lecteur d’écran via Semantics).
/// - Icône **informative** seule (statut, badge sans texte) : fournir
///   [semanticLabel].
class ViroIcon extends StatelessWidget {
  const ViroIcon(
    this.icon, {
    super.key,
    this.size = 22,
    this.color,
    this.semanticLabel,
    this.shadows,
  });

  final IconData icon;
  final double size;
  final Color? color;

  /// Libellé si l’icône porte une info non redondante avec un texte voisin.
  final String? semanticLabel;

  /// Ombres / halo de l’icône (ex. `palette.neonGlow` en sombre).
  final List<Shadow>? shadows;

  @override
  Widget build(BuildContext context) {
    final resolvedColor =
        color ?? IconTheme.of(context).color ?? const Color(0xFF0B3358);

    final iconWidget = PhosphorIcon(
      icon,
      size: size,
      color: resolvedColor,
      shadows: shadows,
    );
    if (semanticLabel == null) {
      return ExcludeSemantics(child: iconWidget);
    }
    return Semantics(label: semanticLabel, child: iconWidget);
  }
}
