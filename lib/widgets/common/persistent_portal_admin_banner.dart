import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/widgets/common/portal_admin_banner.dart';

/// Bannière portail dont le masquage (croix) est mémorisé localement par utilisateur + écran.
class PersistentPortalAdminBanner extends ConsumerStatefulWidget {
  const PersistentPortalAdminBanner({
    super.key,
    required this.bannerId,
    required this.portalUrl,
    required this.message,
    this.compact = false,
    this.ctaLabel = 'Ouvrir l\'espace club',
    this.accentColor,
  });

  final String bannerId;
  final Uri portalUrl;
  final String message;
  final bool compact;
  final String ctaLabel;
  final Color? accentColor;

  @override
  ConsumerState<PersistentPortalAdminBanner> createState() =>
      _PersistentPortalAdminBannerState();
}

class _PersistentPortalAdminBannerState
    extends ConsumerState<PersistentPortalAdminBanner> {
  bool? _isDismissed;
  bool _locallyDismissed = false;

  @override
  void initState() {
    super.initState();
    _loadDismissedState();
  }

  Future<void> _loadDismissedState() async {
    final userId = ref.read(authStateProvider).value?.uid;
    if (userId == null) {
      if (mounted) setState(() => _isDismissed = true);
      return;
    }

    final dismissed = await ref
        .read(portalBannerPrefsServiceProvider)
        .isDismissed(userId: userId, bannerId: widget.bannerId);
    if (mounted) setState(() => _isDismissed = dismissed);
  }

  Future<void> _dismiss() async {
    final userId = ref.read(authStateProvider).value?.uid;
    if (userId == null) return;

    setState(() => _locallyDismissed = true);

    await ref.read(portalBannerPrefsServiceProvider).dismiss(
          userId: userId,
          bannerId: widget.bannerId,
        );
  }

  @override
  Widget build(BuildContext context) {
    if (_isDismissed == null || _isDismissed == true || _locallyDismissed) {
      return const SizedBox.shrink();
    }

    return PortalAdminBanner(
      portalUrl: widget.portalUrl,
      message: widget.message,
      compact: widget.compact,
      ctaLabel: widget.ctaLabel,
      accentColor: widget.accentColor,
      onDismiss: _dismiss,
    );
  }
}
