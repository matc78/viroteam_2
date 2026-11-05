import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_assets.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';

/// Couleurs d’une bulle de message (fond, contour, textes, halo).
@immutable
class ChatBubbleColors {
  const ChatBubbleColors({
    required this.background,
    required this.text,
    required this.secondaryText,
    this.border,
    this.glow = const [],
  });

  final Color background;
  final Color text;

  /// Heure, citation, libellés discrets dans la bulle.
  final Color secondaryText;

  /// Contour (`null` = aucun).
  final Color? border;

  /// Halo néon autour de la bulle (sombre, mes messages).
  final List<BoxShadow> glow;
}

/// Tokens de la messagerie (bulles, avatars, menus), alignés sur les
/// variables `--chat-*` du portail (`portal/src/app/globals.css`).
///
/// Valeurs en pixels logiques ; toute nouvelle valeur doit exister des deux
/// côtés.
abstract final class ViroChat {
  /// Rayon des bulles de message et de sondage.
  static const double bubbleRadius = 14;

  /// Rayon du coin « queue » d’une bulle (côté expéditeur).
  static const double bubbleTailRadius = 4;

  /// Marges internes d’une bulle.
  static const double bubblePaddingX = 12;
  static const double bubblePaddingY = 8;

  /// Largeur max d’une bulle, en fraction de la largeur du fil.
  static const double bubbleMaxWidthFraction = 0.78;

  /// Espace vertical entre deux messages.
  static const double messageGap = 8;

  /// Espace vertical entre deux messages d’un même groupe.
  static const double messageGroupGap = 2;

  /// Écart max entre deux messages d’un même expéditeur pour les regrouper.
  static const Duration messageGroupWindow = Duration(minutes: 5);

  /// Largeur d’une photo dans une bulle ; hauteur bornée par le ratio.
  static const double imageWidth = 220;
  static const double imageMinHeight = 120;
  static const double imageMaxHeight = 320;

  /// Rayon de la citation (réponse) et de la photo dans une bulle.
  static const double quoteRadius = 8;

  /// Diamètres d’avatar : inbox, en-tête du fil, expéditeur d’une bulle,
  /// votants d’un sondage, fiche de la conversation.
  static const double avatarInbox = 44;
  static const double avatarHeader = 36;
  static const double avatarSender = 28;
  static const double avatarPollVoter = 22;
  static const double avatarHero = 88;

  /// Rapport icône / avatar (groupe, canal) : 20 px pour 44 px.
  static const double avatarIconRatio = 20 / 44;

  /// Rapport initiale / avatar (DM sans photo).
  static const double avatarInitialRatio = 0.4;

  /// Nombre max d’emojis affichés sous une bulle ; au-delà, chip « +n »
  /// (`MAX_VISIBLE_REACTIONS` côté portail).
  static const int reactionChipsMax = 4;

  /// Menu « + » du composer : carte, lignes et libellés.
  static const double attachMenuRadius = 12;
  static const double attachMenuItemRadius = 9;
  static const double attachMenuLabelSize = 12.5;

  /// Menu « + » sur mobile (app) : pastilles et libellés agrandis, voile
  /// flouté derrière pour détacher le menu du fil.
  static const double attachMenuMobileIconBox = 38;
  static const double attachMenuMobileIconSize = 19;
  static const double attachMenuMobileLabelSize = 16;
  static const double attachMenuBackdropBlur = 6;
  static const double attachMenuBackdropDim = 0.28;

  /// Fond motif du fil de discussion.
  static const String threadBackgroundAsset = ViroAssets.chatThreadBackground;

  /// Bulles (app) — clair : les miennes en bleu marque opaque (texte
  /// foncé), les autres en blanc, sans contour. Sombre : fond noir, texte
  /// blanc, contour couleur du club (blanc si elle est quasi noire) et, pour
  /// les miennes, la couleur opposée du club en néon (bleu néon si le club
  /// n’a pas de teinte : noir, gris, blanc).
  static const Color bubbleMineLight = ViroColors.primary100;
  static const Color bubbleOtherLight = ViroColors.white;
  static const Color bubbleDark = Color(0xFF000000);
  static const Color bubbleMineNeon = Color(0xFF00C8FF);
  static const double bubbleBorderWidth = 1.5;

  /// Luminance sous laquelle une couleur club est jugée « noire » sur le
  /// fond sombre des bulles (contour remplacé par du blanc).
  static const double bubbleClubBorderMinLuminance = 0.04;

  /// Saturation sous laquelle une couleur club n’a pas de teinte exploitable
  /// (pas d’opposée) ; luminosité HSL du néon opposé.
  static const double bubbleClubMinSaturation = 0.15;
  static const double bubbleMineNeonLightness = 0.6;

  /// Contour néon de mes bulles en sombre : teinte opposée (+180°) à
  /// [clubColor], saturée, pour se distinguer du contour des autres.
  static Color bubbleMineBorderDark(Color clubColor) {
    final hsl = HSLColor.fromColor(clubColor);
    if (hsl.saturation < bubbleClubMinSaturation) return bubbleMineNeon;
    return HSLColor.fromAHSL(
      1,
      (hsl.hue + 180) % 360,
      1,
      bubbleMineNeonLightness,
    ).toColor();
  }

  /// Couleurs d’une bulle selon le thème ([palette]), l’auteur ([mine]) et
  /// la couleur du club ([clubColor], contour des messages reçus en sombre).
  static ChatBubbleColors bubbleColors({
    required ViroPalette palette,
    required bool mine,
    required Color clubColor,
  }) {
    if (!palette.isDark) {
      return ChatBubbleColors(
        background: mine ? bubbleMineLight : bubbleOtherLight,
        text: palette.textPrimary,
        secondaryText: palette.textSecondary,
      );
    }
    if (mine) {
      final mineBorder = bubbleMineBorderDark(clubColor);
      return ChatBubbleColors(
        background: bubbleDark,
        text: ViroColors.white,
        secondaryText: palette.textSecondary,
        border: mineBorder,
        glow: palette.neonBoxGlow(mineBorder, blur: 10, alpha: 0.35),
      );
    }
    final clubBorder =
        clubColor.computeLuminance() < bubbleClubBorderMinLuminance
        ? ViroColors.white
        : palette.readableAccent(clubColor);
    return ChatBubbleColors(
      background: bubbleDark,
      text: ViroColors.white,
      secondaryText: palette.textSecondary,
      border: clubBorder,
    );
  }
}
