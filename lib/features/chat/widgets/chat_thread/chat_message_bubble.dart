import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:viro_team_v2/config/viro_chat.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_bubble_timestamp.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_reaction_chip.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_helpers.dart';
import 'package:viro_team_v2/models/chat_message.dart';

/// Hauteur des chips de réaction sous la bulle (elles chevauchent sa bordure).
const double _reactionChipsOverflow = 20;

/// Bulle texte / image d’un message du fil (hors sondage).
class ChatMessageBubble extends StatelessWidget {
  const ChatMessageBubble({
    super.key,
    required this.anchorKey,
    required this.message,
    required this.mine,
    required this.viewerUid,
    required this.borderColor,
    required this.onLongPress,
    required this.onDoubleTap,
    required this.onOpenReactors,
    this.senderLabel = '',
    this.replySenderLabel = '',
    this.highlightQuery,
    this.isSearchMatch = false,
    this.isCurrentSearchMatch = false,
    this.groupPosition = (isFirst: true, isLast: true),
    this.uploadProgress,
    this.onImageTap,
    this.onReplyTap,
    this.onRetry,
    this.onReply,
  });

  /// Ancre visuelle de la bulle (pas le Align pleine largeur).
  final GlobalKey anchorKey;
  final ChatMessage message;
  final bool mine;
  final String? viewerUid;
  final Color borderColor;
  final VoidCallback onLongPress;
  final VoidCallback onDoubleTap;
  final VoidCallback onOpenReactors;

  /// Prénom + nom en haut de bulle (groupes, messages des autres).
  final String senderLabel;
  final String replySenderLabel;
  final String? highlightQuery;
  final bool isSearchMatch;

  /// Résultat de recherche actuellement sélectionné (contour marqué).
  final bool isCurrentSearchMatch;

  /// Place dans le groupe : marges serrées et coin « queue » sur le dernier.
  final ChatThreadGroupPosition groupPosition;

  /// Avancement (0 → 1) de l’upload de la photo, `null` hors envoi.
  final double? uploadProgress;
  final VoidCallback? onImageTap;
  final VoidCallback? onReplyTap;

  /// Réessaie un envoi optimiste en échec.
  final VoidCallback? onRetry;

  /// Répond à ce message (action des lecteurs d’écran) ; `null` si
  /// l’utilisateur ne peut pas écrire dans la discussion.
  final VoidCallback? onReply;

  /// Actions proposées aux lecteurs d’écran à la place des gestes
  /// (double-tap cœur, appui long, tap sur les chips).
  Map<CustomSemanticsAction, VoidCallback> _semanticsActions({
    required bool hasReactions,
  }) {
    final reply = onReply;
    return {
      if (reply != null && !message.isLocalPending)
        CustomSemanticsAction(label: AppCopy.chat.reply): reply,
      if (!message.isLocalPending)
        CustomSemanticsAction(label: AppCopy.chat.reactWithHeart): onDoubleTap,
      if (hasReactions)
        CustomSemanticsAction(label: AppCopy.chat.reactionReactors):
            onOpenReactors,
      CustomSemanticsAction(label: AppCopy.chat.messageActions): onLongPress,
    };
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final align = mine ? Alignment.centerRight : Alignment.centerLeft;
    final topGap =
        (groupPosition.isFirst
            ? ViroChat.messageGap
            : ViroChat.messageGroupGap) /
        2;
    final bottomGap =
        (groupPosition.isLast
            ? ViroChat.messageGap
            : ViroChat.messageGroupGap) /
        2;

    if (message.isDeleted) {
      return Align(
        alignment: align,
        child: Padding(
          padding: EdgeInsets.only(top: topGap, bottom: bottomGap),
          child: Text(
            AppCopy.chat.messageDeleted,
            style: theme.bodySmall?.copyWith(
              fontStyle: FontStyle.italic,
              color: palette.textMuted,
            ),
          ),
        ),
      );
    }

    final reactionEntries = message.reactions.entries
        .where((e) => e.value.isNotEmpty)
        .toList();
    final reactionChips = chatThreadReactionChips(message.reactions);
    final hasReactions = reactionEntries.isNotEmpty;
    final imageUrl = (message.thumbUrl ?? message.downloadUrl ?? '').trim();
    final foreground = mine ? palette.onAccent : palette.brandText;
    final secondary = mine
        ? palette.onAccent.withValues(alpha: 0.85)
        : palette.textSecondary;
    const radius = Radius.circular(ViroChat.bubbleRadius);
    const tail = Radius.circular(ViroChat.bubbleTailRadius);
    final hasTail = groupPosition.isLast;
    final bubbleRadius = BorderRadius.only(
      topLeft: radius,
      topRight: radius,
      bottomLeft: hasTail && !mine ? tail : radius,
      bottomRight: hasTail && mine ? tail : radius,
    );
    final Color background;
    if (mine) {
      background = palette.accentFill;
    } else if (isSearchMatch) {
      background = ViroColors.warning.withValues(alpha: 0.12);
    } else {
      background = palette.surfaceCard;
    }
    final Border? border = isCurrentSearchMatch || (mine && isSearchMatch)
        ? Border.all(color: ViroColors.warning, width: 2)
        : mine
        ? null
        : Border.all(color: borderColor, width: 1.5);
    final imageSize = chatThreadImageSize(
      width: message.width,
      height: message.height,
    );

    return Align(
      alignment: align,
      child: Padding(
        padding: EdgeInsets.only(
          top: topGap,
          bottom: hasReactions ? 0 : bottomGap,
        ),
        child: Stack(
          key: anchorKey,
          clipBehavior: Clip.none,
          children: [
            Padding(
              // Les chips débordent sous la bulle : leur zone de tap (≥ 44)
              // reste dans le Stack pour être atteignable.
              padding: EdgeInsets.only(
                bottom: hasReactions ? _reactionChipsOverflow : 0,
              ),
              child: Semantics(
                customSemanticsActions: _semanticsActions(
                  hasReactions: hasReactions,
                ),
                child: GestureDetector(
                  onLongPress: onLongPress,
                  onDoubleTap: onDoubleTap,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: ViroChat.bubblePaddingX,
                      vertical: ViroChat.bubblePaddingY,
                    ),
                    constraints: BoxConstraints(
                      maxWidth:
                          MediaQuery.sizeOf(context).width *
                          ViroChat.bubbleMaxWidthFraction,
                    ),
                    decoration: BoxDecoration(
                      color: background,
                      borderRadius: bubbleRadius,
                      border: border,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (senderLabel.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 2),
                            child: Text(
                              senderLabel,
                              style: theme.labelSmall?.copyWith(
                                color: palette.readableAccent(borderColor),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        if (message.hasReply)
                          GestureDetector(
                            onTap: onReplyTap,
                            child: Container(
                              width: double.infinity,
                              margin: const EdgeInsets.only(bottom: 6),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: mine
                                    ? palette.onAccent.withValues(alpha: 0.16)
                                    : palette.accentSofter,
                                borderRadius: BorderRadius.circular(
                                  ViroChat.quoteRadius,
                                ),
                                border: Border(
                                  left: BorderSide(
                                    color: mine
                                        ? palette.onAccent
                                        : borderColor,
                                    width: 3,
                                  ),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (replySenderLabel.isNotEmpty)
                                    Text(
                                      replySenderLabel,
                                      style: theme.labelSmall?.copyWith(
                                        color: mine
                                            ? foreground
                                            : palette.readableAccent(
                                                borderColor,
                                              ),
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  Text(
                                    message.replyToText ?? '',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.bodySmall?.copyWith(
                                      color: secondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        if (message.type == ChatMessageTypes.image &&
                            (imageUrl.isNotEmpty ||
                                message.localImageBytes != null))
                          GestureDetector(
                            onTap: onImageTap,
                            child: Stack(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(
                                    ViroChat.quoteRadius,
                                  ),
                                  child: _ChatBubbleImage(
                                    url: imageUrl,
                                    localBytes: message.localImageBytes,
                                    size: imageSize,
                                  ),
                                ),
                                if (uploadProgress != null)
                                  Positioned.fill(
                                    child: _UploadProgressOverlay(
                                      progress: uploadProgress!,
                                    ),
                                  ),
                                Positioned(
                                  right: 6,
                                  bottom: 6,
                                  child: ChatBubbleTimestamp(
                                    sentAt: message.createdAt,
                                    edited: message.editedAt != null,
                                    onImage: true,
                                    localStatus: message.localStatus,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          ChatBubbleTextWithTime(
                            text: message.text ?? '',
                            sentAt: message.createdAt,
                            edited: message.editedAt != null,
                            highlightQuery: highlightQuery,
                            localStatus: message.localStatus,
                            onAccent: mine,
                            style: theme.bodyMedium?.copyWith(
                              color: foreground,
                            ),
                          ),
                        if (message.isSendFailed && onRetry != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: TextButton(
                              onPressed: onRetry,
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: ViroSpacing.xs,
                                ),
                                minimumSize: const Size.square(
                                  ViroSpacing.minTouchTarget,
                                ),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              child: Text(
                                AppCopy.chat.retrySend,
                                style: theme.labelSmall?.copyWith(
                                  color: mine ? foreground : palette.errorText,
                                  fontWeight: FontWeight.w700,
                                  decoration: mine
                                      ? TextDecoration.underline
                                      : null,
                                  decorationColor: foreground,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            if (hasReactions)
              Positioned(
                // Ancrées côté intérieur du fil (à gauche pour les messages
                // reçus, à droite pour les tiens) : une rangée plus large
                // qu’une bulle courte déborde vers le centre, pas hors écran.
                left: mine ? null : 8,
                right: mine ? 8 : null,
                bottom: 0,
                child: Semantics(
                  button: true,
                  label: AppCopy.chat.reactionChipsLabel([
                    for (final entry in reactionEntries)
                      (emoji: entry.key, count: entry.value.length),
                  ]),
                  hint: AppCopy.chat.reactionReactors,
                  onTap: onOpenReactors,
                  excludeSemantics: true,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(999),
                      onTap: onOpenReactors,
                      onLongPress: onLongPress,
                      // Zone de tap ≥ 44 : remonte sur le bas de la bulle,
                      // les chips restent à leur place (4 px sous le bord).
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          minWidth: ViroSpacing.minTouchTarget,
                          minHeight: ViroSpacing.minTouchTarget,
                        ),
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          widthFactor: 1,
                          heightFactor: 1,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            // Une seule rangée : au-delà de
                            // ViroChat.reactionChipsMax emojis, chip « +n ».
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              spacing: 4,
                              children: [
                                for (final entry in reactionChips.visible)
                                  ChatReactionChip(
                                    emoji: entry.key,
                                    count: entry.value.length,
                                    mine:
                                        viewerUid != null &&
                                        entry.value.contains(viewerUid),
                                  ),
                                if (reactionChips.hiddenCount > 0)
                                  ChatReactionChip.more(
                                    hiddenCount: reactionChips.hiddenCount,
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
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

/// Photo d’une bulle : octets locaux (envoi) ou réseau, à taille fixe
/// (pas de saut de mise en page), avec placeholder et état d’erreur.
class _ChatBubbleImage extends StatelessWidget {
  const _ChatBubbleImage({
    required this.url,
    required this.localBytes,
    required this.size,
  });

  final String url;
  final Uint8List? localBytes;
  final Size size;

  @override
  Widget build(BuildContext context) {
    final cacheWidth = (size.width * MediaQuery.devicePixelRatioOf(context))
        .round();
    final bytes = localBytes;
    if (bytes != null) {
      return Image.memory(
        bytes,
        width: size.width,
        height: size.height,
        fit: BoxFit.cover,
        cacheWidth: cacheWidth,
      );
    }
    return Image.network(
      url,
      width: size.width,
      height: size.height,
      fit: BoxFit.cover,
      cacheWidth: cacheWidth,
      loadingBuilder: (context, child, progress) => progress == null
          ? child
          : _ImagePlaceholder(size: size, loading: true),
      errorBuilder: (_, _, _) => _ImagePlaceholder(size: size),
    );
  }
}

/// Fond neutre pendant le chargement, ou icône si la photo ne charge pas.
class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder({required this.size, this.loading = false});

  final Size size;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Container(
      width: size.width,
      height: size.height,
      alignment: Alignment.center,
      color: palette.surfaceMuted,
      child: loading
          ? null
          : ViroIcon(
              ViroIcons.image,
              color: palette.textMuted,
              semanticLabel: AppCopy.chat.imageLoadFailed,
            ),
    );
  }
}

/// Voile + anneau de progression pendant l’upload d’une photo.
class _UploadProgressOverlay extends StatelessWidget {
  const _UploadProgressOverlay({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ViroChat.quoteRadius),
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.3),
        child: Center(
          child: SizedBox.square(
            dimension: 36,
            child: CircularProgressIndicator(
              value: progress <= 0 ? null : progress,
              strokeWidth: 3,
              color: ViroColors.white,
              semanticsLabel: AppCopy.chat.photoUploading,
            ),
          ),
        ),
      ),
    );
  }
}
