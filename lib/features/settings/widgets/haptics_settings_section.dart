import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/providers/haptics_enabled_provider.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Section paramètres : activer / couper le retour haptique (vibrations).
class HapticsSettingsSection extends ConsumerWidget {
  const HapticsSettingsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enabled = ref.watch(hapticsEnabledProvider);

    return ViroCard(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.xs,
      ),
      child: SwitchListTile.adaptive(
        contentPadding: EdgeInsets.zero,
        title: Text(AppCopy.settings.hapticsToggle),
        subtitle: Text(AppCopy.settings.hapticsToggleSubtitle),
        value: enabled,
        onChanged: (next) =>
            ref.read(hapticsEnabledProvider.notifier).select(enabled: next),
      ),
    );
  }
}
