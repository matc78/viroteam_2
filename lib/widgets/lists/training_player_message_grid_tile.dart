import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Taille de l'avatar en mode compact / déplié.
const double _compactAvatarSize = 40;
const double _expandedAvatarSize = 32;

/// Part de la hauteur dépliée à atteindre avant d'afficher le champ
/// (évite de dessiner le formulaire dans une tuile encore trop petite).
const double _expandedRevealRatio = 0.85;

/// Joueur d'un retour de séance, en petite tuile de grille
/// (`ViroExpandableTileGrid`).
///
/// Compacte : avatar, prénom, nom et état du message ; un tap la déplie.
/// Dépliée : champ du message perso, bouton pour replier.
class TrainingPlayerMessageGridTile extends StatefulWidget {
  const TrainingPlayerMessageGridTile({
    super.key,
    required this.member,
    required this.message,
    required this.expanded,
    required this.onExpand,
    required this.onCollapse,
    required this.onChanged,
  });

  final ClubMember member;

  /// Message actuel (vide = pas de message).
  final String message;
  final bool expanded;
  final VoidCallback onExpand;
  final VoidCallback onCollapse;
  final ValueChanged<String> onChanged;

  /// Hauteur de la tuile compacte, selon la taille de texte.
  static double compactHeight(TextScaler textScaler) =>
      ViroSpacing.sm * 2 +
      _compactAvatarSize +
      ViroSpacing.xs +
      textScaler.scale(62);

  /// Hauteur de la tuile dépliée, selon la taille de texte.
  static double expandedHeight(TextScaler textScaler) =>
      ViroSpacing.sm * 3 + ViroSpacing.minTouchTarget + textScaler.scale(150);

  @override
  State<TrainingPlayerMessageGridTile> createState() =>
      _TrainingPlayerMessageGridTileState();
}

class _TrainingPlayerMessageGridTileState
    extends State<TrainingPlayerMessageGridTile> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.message,
  );

  @override
  void didUpdateWidget(covariant TrainingPlayerMessageGridTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Brouillon chargé après coup : ne pas écraser une saisie en cours.
    if (widget.message != _controller.text && _controller.text.isEmpty) {
      _controller.text = widget.message;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _name => widget.member.fullName.isNotEmpty
      ? widget.member.fullName
      : AppCopy.training.unknownPlayer;

  bool get _hasMessage => widget.message.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final textScaler = MediaQuery.textScalerOf(context);
    final compactHeight = TrainingPlayerMessageGridTile.compactHeight(
      textScaler,
    );
    final revealHeight =
        compactHeight +
        (TrainingPlayerMessageGridTile.expandedHeight(textScaler) -
                compactHeight) *
            _expandedRevealRatio;

    return LayoutBuilder(
      builder: (context, constraints) {
        final showForm =
            widget.expanded && constraints.maxHeight >= revealHeight;
        return ViroCard(
          elevated: false,
          margin: EdgeInsets.zero,
          borderColor: _hasMessage || widget.expanded ? palette.accent : null,
          onTap: widget.expanded ? null : widget.onExpand,
          semanticLabel: widget.expanded
              ? null
              : AppCopy.training.playerMessageSemantics(_name, _hasMessage),
          padding: const EdgeInsets.all(ViroSpacing.sm),
          child: SizedBox(
            height: constraints.maxHeight - ViroSpacing.sm * 2 - 2,
            child: ClipRect(
              child: AnimatedSwitcher(
                duration: ViroMotion.fast,
                child: showForm
                    ? _ExpandedContent(
                        key: const ValueKey('expanded'),
                        member: widget.member,
                        name: _name,
                        controller: _controller,
                        onChanged: widget.onChanged,
                        onCollapse: widget.onCollapse,
                      )
                    : _CompactContent(
                        key: const ValueKey('compact'),
                        member: widget.member,
                        hasMessage: _hasMessage,
                      ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Tuile repliée : avatar, prénom / nom centrés et état du message.
class _CompactContent extends StatelessWidget {
  const _CompactContent({
    super.key,
    required this.member,
    required this.hasMessage,
  });

  final ClubMember member;
  final bool hasMessage;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final firstName = member.firstName?.trim() ?? '';
    final lastName = member.lastName?.trim() ?? '';
    return ExcludeSemantics(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          MemberAvatar(member: member, size: _compactAvatarSize),
          const SizedBox(height: ViroSpacing.xs),
          Text(
            firstName.isNotEmpty ? firstName : AppCopy.training.unknownPlayer,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: theme.bodyMedium?.copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (lastName.isNotEmpty)
            Text(
              lastName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
          if (hasMessage)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ViroIcon(
                  ViroIcons.checkCircle,
                  size: 14,
                  color: palette.accent,
                ),
                const SizedBox(width: 3),
                Flexible(
                  child: Text(
                    AppCopy.training.playerMessageWritten,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.labelSmall?.copyWith(
                      color: palette.accent,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// Tuile dépliée : en-tête joueur et champ du message perso.
class _ExpandedContent extends StatelessWidget {
  const _ExpandedContent({
    super.key,
    required this.member,
    required this.name,
    required this.controller,
    required this.onChanged,
    required this.onCollapse,
  });

  final ClubMember member;
  final String name;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onCollapse;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            MemberAvatar(member: member, size: _expandedAvatarSize),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.bodyMedium?.copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            IconButton(
              onPressed: onCollapse,
              tooltip: AppCopy.training.playerMessageCollapse,
              icon: ViroIcon(ViroIcons.chevronUp, size: 20),
            ),
          ],
        ),
        const SizedBox(height: ViroSpacing.xs),
        Expanded(
          child: TextField(
            controller: controller,
            onChanged: onChanged,
            autofocus: controller.text.isEmpty,
            expands: true,
            minLines: null,
            maxLines: null,
            maxLength: TrainingRatings.messageMaxChars,
            textAlignVertical: TextAlignVertical.top,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: AppCopy.training.playerMessageHint,
            ),
          ),
        ),
      ],
    );
  }
}
