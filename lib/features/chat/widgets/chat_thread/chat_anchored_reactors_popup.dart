import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Popup ancré au message : sous le message, ou au-dessus si pas de place.
class ChatAnchoredReactorsPopup extends StatefulWidget {
  const ChatAnchoredReactorsPopup({
    super.key,
    required this.stackKey,
    required this.anchorKey,
    required this.message,
    required this.mine,
    required this.viewerUid,
    required this.nameByUid,
    required this.memberByUid,
    required this.onDismiss,
    required this.onAddReaction,
    required this.onToggleReaction,
  });

  final GlobalKey stackKey;
  final GlobalKey anchorKey;
  final ChatMessage message;
  final bool mine;
  final String? viewerUid;
  final Map<String, String> nameByUid;
  final Map<String, ClubMember> memberByUid;
  final VoidCallback onDismiss;
  final VoidCallback onAddReaction;
  final ValueChanged<String> onToggleReaction;

  @override
  State<ChatAnchoredReactorsPopup> createState() =>
      _ChatAnchoredReactorsPopupState();
}

class _ChatAnchoredReactorsPopupState extends State<ChatAnchoredReactorsPopup> {
  String _filter = 'all';
  bool _layoutRetryScheduled = false;

  static const double _popupWidth = 280;
  static const double _gap = 8;
  static const double _edge = 8;
  static const double _maxPopupHeight = 280;
  static const double _preferBelowMin = 120;

  @override
  Widget build(BuildContext context) {
    final entries = widget.message.reactions.entries
        .where((e) => e.value.isNotEmpty)
        .toList();
    final total = entries.fold<int>(0, (sum, e) => sum + e.value.length);

    final rows = <({String uid, String emoji})>[];
    for (final entry in entries) {
      if (_filter != 'all' && entry.key != _filter) continue;
      for (final uid in entry.value) {
        rows.add((uid: uid, emoji: entry.key));
      }
    }
    rows.sort((a, b) {
      final aMine =
          widget.viewerUid != null && a.uid == widget.viewerUid ? 0 : 1;
      final bMine =
          widget.viewerUid != null && b.uid == widget.viewerUid ? 0 : 1;
      if (aMine != bMine) return aMine - bMine;
      final aName = widget.nameByUid[a.uid] ?? '';
      final bName = widget.nameByUid[b.uid] ?? '';
      return aName.compareTo(bName);
    });

    final layout = _computeLayout();
    if (layout == null && !_layoutRetryScheduled) {
      _layoutRetryScheduled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _layoutRetryScheduled = false;
        if (mounted) setState(() {});
      });
    }

    // Pas de barrière plein écran : elle bloquait le scroll du fil.
    if (layout == null) return const SizedBox.shrink();

    return Positioned(
      left: layout.left,
      top: layout.top,
      width: _popupWidth,
      child: Material(
        color: ViroColors.white,
        elevation: ViroMotion.elevationMenu,
        shadowColor: ViroColors.primary900.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: layout.maxHeight),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.md,
                  ViroSpacing.md,
                  ViroSpacing.md,
                  ViroSpacing.sm,
                ),
                child: Text(
                  AppCopy.chat.reactionCountLabel(total),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: ViroSpacing.md,
                ),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    InkWell(
                      borderRadius: BorderRadius.circular(999),
                      onTap: widget.onAddReaction,
                      child: Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: ViroColors.gray200),
                        ),
                        child: ViroIcon(
                          ViroIcons.smiley,
                          color: ViroColors.primary600,
                          size: 20,
                        ),
                      ),
                    ),
                    for (final entry in entries)
                      ChoiceChip(
                        label: Text('${entry.key} ${entry.value.length}'),
                        selected: _filter == entry.key,
                        onSelected: (_) {
                          setState(() {
                            _filter =
                                _filter == entry.key ? 'all' : entry.key;
                          });
                        },
                      ),
                  ],
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              const Divider(height: 1),
              // Flexible : la liste cède si le header + rows dépassent maxHeight.
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  itemCount: rows.length,
                  itemBuilder: (context, index) {
                    final row = rows[index];
                    final mine = widget.viewerUid != null &&
                        row.uid == widget.viewerUid;
                    final firstName = widget.nameByUid[row.uid]?.trim() ?? '';
                    final displayName = mine
                        ? AppCopy.chat.you
                        : (firstName.isNotEmpty
                            ? firstName
                            : AppCopy.common.memberFallback);
                    return ListTile(
                      dense: true,
                      leading: _reactorAvatar(
                        uid: row.uid,
                        firstName: firstName,
                      ),
                      title: Text(
                        displayName,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: mine
                          ? Text(AppCopy.chat.reactionRemoveMine)
                          : null,
                      trailing: Text(
                        row.emoji,
                        style: const TextStyle(fontSize: 22),
                      ),
                      onTap: mine
                          ? () => widget.onToggleReaction(row.emoji)
                          : null,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Avatar : photo si dispo, sinon initiale du prénom (jamais celle de « Vous »).
  Widget _reactorAvatar({
    required String uid,
    required String firstName,
  }) {
    final member = widget.memberByUid[uid];
    final photoUrl = member?.avatarUrl?.trim();
    final hasPhoto = member != null &&
        member.hasLinkedAccount &&
        photoUrl != null &&
        photoUrl.isNotEmpty;

    if (hasPhoto) {
      return MemberAvatar(member: member, size: 36);
    }

    final preferred = member?.preferredFirstName.trim() ?? '';
    final fromMember =
        preferred.isNotEmpty && preferred != AppCopy.common.childFallback
            ? preferred
            : (member?.fullName.trim() ?? '');
    final initialSource = firstName.isNotEmpty ? firstName : fromMember;
    final initial =
        initialSource.isNotEmpty ? initialSource[0].toUpperCase() : '?';

    return CircleAvatar(
      radius: 18,
      backgroundColor: ViroColors.primary100,
      child: Text(
        initial,
        style: const TextStyle(
          color: ViroColors.primary800,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  /// Calcule left/top/maxHeight collés à la bulle (sous ou au-dessus).
  ({double left, double top, double maxHeight})? _computeLayout() {
    final stackContext = widget.stackKey.currentContext;
    final anchorContext = widget.anchorKey.currentContext;
    if (stackContext == null || anchorContext == null) return null;

    final stackBox = stackContext.findRenderObject() as RenderBox?;
    final anchorBox = anchorContext.findRenderObject() as RenderBox?;
    if (stackBox == null ||
        anchorBox == null ||
        !stackBox.attached ||
        !anchorBox.attached ||
        !stackBox.hasSize ||
        !anchorBox.hasSize) {
      return null;
    }

    // Conversion via global → plus fiable que ancestor: sur web.
    final stackOrigin = stackBox.localToGlobal(Offset.zero);
    final anchorOrigin = anchorBox.localToGlobal(Offset.zero);
    final anchorOffset = anchorOrigin - stackOrigin;
    final stackSize = stackBox.size;
    final anchorSize = anchorBox.size;
    final messageBottom = anchorOffset.dy + anchorSize.height;

    if (messageBottom < _edge || anchorOffset.dy > stackSize.height - _edge) {
      return null;
    }

    final spaceBelow = stackSize.height - messageBottom - _gap - _edge;
    final spaceAbove = anchorOffset.dy - _gap - _edge;
    final showBelow =
        spaceBelow >= _preferBelowMin || spaceBelow >= spaceAbove;

    double top;
    double maxHeight;

    if (showBelow) {
      top = messageBottom + _gap;
      if (top < _edge) top = _edge;
      maxHeight =
          (stackSize.height - top - _edge).clamp(72.0, _maxPopupHeight);
    } else {
      maxHeight = spaceAbove.clamp(72.0, _maxPopupHeight);
      top = anchorOffset.dy - _gap - maxHeight;
      if (top < _edge) {
        top = _edge;
        maxHeight =
            (anchorOffset.dy - _gap - top).clamp(72.0, _maxPopupHeight);
      }
    }

    if (maxHeight < 72) return null;

    // Aligne sur la bulle (droite si message à toi, gauche sinon).
    double left = widget.mine
        ? anchorOffset.dx + anchorSize.width - _popupWidth
        : anchorOffset.dx;
    final maxLeft = stackSize.width - _popupWidth - _edge;
    if (maxLeft < _edge) {
      left = _edge;
    } else {
      left = left.clamp(_edge, maxLeft);
    }

    return (left: left, top: top, maxHeight: maxHeight);
  }
}
