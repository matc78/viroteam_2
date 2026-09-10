import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/utils/open_maps.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Affiche une bottom sheet pour ouvrir [address] dans Maps / Waze / Plans.
Future<void> showOpenAddressSheet(
  BuildContext context, {
  required String address,
}) {
  final trimmed = address.trim();
  if (trimmed.isEmpty) return Future.value();

  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: ViroColors.surfaceCard,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(ViroSpacing.cardRadius),
      ),
    ),
    builder: (sheetContext) => _OpenAddressSheet(address: trimmed),
  );
}

class _OpenAddressSheet extends StatelessWidget {
  const _OpenAddressSheet({required this.address});

  final String address;

  bool get _showAppleMaps {
    if (kIsWeb) return false;
    return Platform.isIOS;
  }

  Future<void> _open(BuildContext context, MapsApp app) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    Navigator.pop(context);
    final launched = await openAddressInMaps(app, address);
    if (!launched) {
      messenger?.showSnackBar(
        SnackBar(
          content: Text(AppCopy.club.cannotOpenMaps),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ViroSpacing.lg,
          ViroSpacing.xs,
          ViroSpacing.lg,
          ViroSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AppCopy.club.openAddressTitle,
              style: theme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: ViroColors.primary800,
              ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Text(
              address,
              style: theme.bodyMedium?.copyWith(
                color: ViroColors.gray600,
                height: 1.35,
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
            _MapsAppTile(
              icon: ViroIcons.google,
              label: 'Google Maps',
              onTap: () => _open(context, MapsApp.googleMaps),
            ),
            _MapsAppTile(
              icon: ViroIcons.navigation,
              label: 'Waze',
              onTap: () => _open(context, MapsApp.waze),
            ),
            if (_showAppleMaps)
              _MapsAppTile(
                icon: ViroIcons.place,
                label: 'Plans',
                onTap: () => _open(context, MapsApp.appleMaps),
              ),
          ],
        ),
      ),
    );
  }
}

class _MapsAppTile extends StatelessWidget {
  const _MapsAppTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = Theme.of(context).colorScheme.primary;

    return ViroPressable(
      floating: false,
      borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          vertical: ViroSpacing.sm,
          horizontal: ViroSpacing.xs,
        ),
        child: Row(
          children: [
            ViroIcon(icon, size: 22, color: accent),
            const SizedBox(width: ViroSpacing.md),
            Expanded(
              child: Text(
                label,
                style: theme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: ViroColors.primary800,
                ),
              ),
            ),
            ViroIcon(
              ViroIcons.chevronRight,
              size: 18,
              color: ViroColors.gray400,
            ),
          ],
        ),
      ),
    );
  }
}
