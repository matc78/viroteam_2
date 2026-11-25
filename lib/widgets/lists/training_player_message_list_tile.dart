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

/// Joueur d'un retour de séance avec son message perso facultatif.
///
/// En saisie, l'icône message déplie un champ texte ; [readOnly] affiche le
/// message envoyé (consultation coach / admin).
class TrainingPlayerMessageListTile extends StatefulWidget {
  const TrainingPlayerMessageListTile({
    super.key,
    required this.member,
    required this.message,
    this.onChanged,
    this.readOnly = false,
  });

  final ClubMember member;

  /// Message actuel (vide = pas de message).
  final String message;

  /// Nouveau texte saisi (ignoré en [readOnly]).
  final ValueChanged<String>? onChanged;
  final bool readOnly;

  @override
  State<TrainingPlayerMessageListTile> createState() =>
      _TrainingPlayerMessageListTileState();
}

class _TrainingPlayerMessageListTileState
    extends State<TrainingPlayerMessageListTile> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.message);
  late bool _expanded = widget.message.trim().isNotEmpty;

  @override
  void didUpdateWidget(covariant TrainingPlayerMessageListTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Brouillon chargé après coup : ne pas écraser une saisie en cours.
    if (widget.message != _controller.text && _controller.text.isEmpty) {
      _controller.text = widget.message;
      if (widget.message.trim().isNotEmpty) _expanded = true;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final name = widget.member.fullName.isNotEmpty
        ? widget.member.fullName
        : AppCopy.training.unknownPlayer;
    final hasMessage = widget.message.trim().isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        elevated: false,
        padding: const EdgeInsets.all(ViroSpacing.sm + 2),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                MemberAvatar(member: widget.member, size: 36),
                const SizedBox(width: ViroSpacing.sm),
                Expanded(
                  child: Semantics(
                    label: AppCopy.training.playerMessageSemantics(
                      name,
                      hasMessage,
                    ),
                    excludeSemantics: true,
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.bodyMedium?.copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                if (!widget.readOnly && !_expanded)
                  IconButton(
                    onPressed: () => setState(() => _expanded = true),
                    tooltip: AppCopy.training.playerMessageHint,
                    icon: ViroIcon(ViroIcons.feedback, size: 18),
                  ),
              ],
            ),
            if (widget.readOnly)
              Padding(
                padding: const EdgeInsets.only(top: ViroSpacing.xs),
                child: Text(
                  hasMessage
                      ? widget.message
                      : AppCopy.training.reviewNoPlayerMessage,
                  style: theme.bodyMedium?.copyWith(
                    color: hasMessage
                        ? palette.textPrimary
                        : palette.textMuted,
                  ),
                ),
              )
            else
              AnimatedSize(
                duration: ViroMotion.fast,
                curve: ViroMotion.enter,
                alignment: Alignment.topCenter,
                child: _expanded
                    ? Padding(
                        padding: const EdgeInsets.only(top: ViroSpacing.sm),
                        child: TextField(
                          controller: _controller,
                          onChanged: widget.onChanged,
                          minLines: 2,
                          maxLines: 5,
                          maxLength: TrainingRatings.messageMaxChars,
                          textCapitalization: TextCapitalization.sentences,
                          decoration: InputDecoration(
                            hintText: AppCopy.training.playerMessageHint,
                          ),
                        ),
                      )
                    : const SizedBox(width: double.infinity),
              ),
          ],
        ),
      ),
    );
  }
}
