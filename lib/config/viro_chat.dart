import 'package:viro_team_v2/config/viro_assets.dart';

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

  /// Menu « + » du composer : carte, lignes et libellés.
  static const double attachMenuRadius = 12;
  static const double attachMenuItemRadius = 9;
  static const double attachMenuLabelSize = 12.5;

  /// Fond motif du fil de discussion.
  static const String threadBackgroundAsset = ViroAssets.chatThreadBackground;
}
