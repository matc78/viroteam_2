import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Bouton « + » du composer chat : menu d’attachments (style portail web).
///
/// Animation : rotation 45° du + et pop du menu vers le haut
/// (`attachPop` portail ≈ [ViroMotion.fast]).
class ChatAttachMenu extends StatefulWidget {
  const ChatAttachMenu({
    super.key,
    required this.enabled,
    required this.showPoll,
    required this.onCamera,
    required this.onGallery,
    this.onPoll,
  });

  final bool enabled;
  final bool showPoll;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback? onPoll;

  @override
  State<ChatAttachMenu> createState() => _ChatAttachMenuState();
}

class _ChatAttachMenuState extends State<ChatAttachMenu>
    with SingleTickerProviderStateMixin {
  final LayerLink _layerLink = LayerLink();
  final OverlayPortalController _portalController = OverlayPortalController();

  bool _open = false;
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: ViroMotion.fast,
    );
    final curve = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
      reverseCurve: Curves.easeIn,
    );
    _fade = curve;
    _scale = Tween<double>(begin: 0.96, end: 1).animate(curve);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.12),
      end: Offset.zero,
    ).animate(curve);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant ChatAttachMenu oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.enabled && _open) {
      _close();
    }
  }

  void _toggle() {
    if (!widget.enabled) return;
    if (_open) {
      _close();
    } else {
      setState(() => _open = true);
      _portalController.show();
      _controller.forward(from: 0);
    }
  }

  void _close() {
    if (!_open) return;
    _controller.reverse().then((_) {
      if (!mounted) return;
      _portalController.hide();
      setState(() => _open = false);
    });
  }

  void _run(VoidCallback action) {
    _close();
    action();
  }

  @override
  Widget build(BuildContext context) {
    return OverlayPortal(
      controller: _portalController,
      overlayChildBuilder: (context) {
        return UnconstrainedBox(
          alignment: Alignment.topLeft,
          child: CompositedTransformFollower(
            link: _layerLink,
            showWhenUnlinked: false,
            targetAnchor: Alignment.topLeft,
            followerAnchor: Alignment.bottomLeft,
            offset: const Offset(0, -7),
            child: TapRegion(
              groupId: _ChatAttachMenuState,
              onTapOutside: (_) => _close(),
              child: FadeTransition(
                opacity: _fade,
                child: SlideTransition(
                  position: _slide,
                  child: ScaleTransition(
                    scale: _scale,
                    alignment: Alignment.bottomLeft,
                    child: _AttachMenuCard(
                      showPoll: widget.showPoll,
                      onCamera: () => _run(widget.onCamera),
                      onGallery: () => _run(widget.onGallery),
                      onPoll: widget.onPoll == null
                          ? null
                          : () => _run(widget.onPoll!),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
      child: CompositedTransformTarget(
        link: _layerLink,
        child: TapRegion(
          groupId: _ChatAttachMenuState,
          child: Semantics(
            button: true,
            label: AppCopy.chat.attachAdd,
            expanded: _open,
            child: _PlusButton(
              open: _open,
              enabled: widget.enabled,
              onTap: _toggle,
            ),
          ),
        ),
      ),
    );
  }
}

class _PlusButton extends StatelessWidget {
  const _PlusButton({
    required this.open,
    required this.enabled,
    required this.onTap,
  });

  final bool open;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ViroPressable(
      onTap: enabled ? onTap : null,
      enabled: enabled,
      floating: false,
      minSize: 40,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: ViroMotion.fast,
        curve: Curves.ease,
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: open
              ? ViroColors.primary600.withValues(alpha: 0.14)
              : ViroColors.gray100,
        ),
        child: AnimatedRotation(
          turns: open ? 0.125 : 0,
          duration: ViroMotion.fast,
          curve: Curves.ease,
          child: ViroIcon(
            ViroIcons.add,
            size: 18,
            color: open ? ViroColors.primary900 : ViroColors.primary800,
          ),
        ),
      ),
    );
  }
}

class _AttachMenuCard extends StatelessWidget {
  const _AttachMenuCard({
    required this.showPoll,
    required this.onCamera,
    required this.onGallery,
    this.onPoll,
  });

  final bool showPoll;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback? onPoll;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(minWidth: 164),
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: ViroColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: ViroColors.gray200),
          boxShadow: ViroMotion.floatingShadow(
            opacity: 0.1,
            blur: 20,
            y: 8,
          ),
        ),
        child: IntrinsicWidth(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _AttachMenuItem(
                icon: ViroIcons.camera,
                tone: ViroColors.sportCyan,
                label: AppCopy.chat.attachCamera,
                onTap: onCamera,
              ),
              _AttachMenuItem(
                icon: ViroIcons.image,
                tone: ViroColors.playerBadgeStart,
                label: AppCopy.chat.attachPhotos,
                onTap: onGallery,
              ),
              if (showPoll && onPoll != null)
                _AttachMenuItem(
                  icon: ViroIcons.poll,
                  tone: ViroColors.warning,
                  label: AppCopy.chat.createPoll,
                  onTap: onPoll!,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AttachMenuItem extends StatelessWidget {
  const _AttachMenuItem({
    required this.icon,
    required this.tone,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color tone;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return ViroPressable(
      onTap: onTap,
      floating: false,
      minSize: 36,
      borderRadius: BorderRadius.circular(9),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: 7,
          vertical: 6,
        ),
        child: Row(
          children: [
            Container(
              width: 25,
              height: 25,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: tone,
              ),
              child: ViroIcon(icon, size: 13, color: ViroColors.white),
            ),
            const SizedBox(width: ViroSpacing.sm),
            Text(
              label,
              style: theme.labelLarge?.copyWith(
                color: ViroColors.primary900,
                fontWeight: FontWeight.w600,
                fontSize: 12.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
