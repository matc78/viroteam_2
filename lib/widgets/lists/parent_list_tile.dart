import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/services/member_service.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Tuile parent (liste admin) avec actions pending / révocation.
class ParentListTile extends StatelessWidget {
  const ParentListTile({
    super.key,
    required this.parent,
    required this.busy,
    required this.statusLabel,
    this.onCopyInvite,
    this.onChangeEmail,
    this.onExtend,
    this.onRegenerate,
    required this.onRevokeChild,
  });

  final ClubParentEntry parent;
  final bool busy;
  final String statusLabel;
  final VoidCallback? onCopyInvite;
  final VoidCallback? onChangeEmail;
  final VoidCallback? onExtend;
  final VoidCallback? onRegenerate;
  final void Function(ClubParentChildRef child) onRevokeChild;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final isPending = parent.status == GuardianStatuses.pending;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        padding: const EdgeInsets.all(ViroSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor:
                      ViroColors.parentBadgeStart.withValues(alpha: 0.2),
                  child: Text(
                    parent.displayName.isNotEmpty
                        ? parent.displayName[0].toUpperCase()
                        : '?',
                    style: const TextStyle(
                      color: ViroColors.primary800,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: ViroSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        parent.displayName,
                        style: theme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (parent.email != null && parent.email!.isNotEmpty)
                        Text(
                          parent.email!,
                          style: theme.bodySmall?.copyWith(
                            color: ViroColors.gray600,
                          ),
                        ),
                      Text(
                        'Enfant(s) : ${parent.children.map((c) => c.displayName).join(', ')}',
                        style: theme.bodySmall?.copyWith(
                          color: ViroColors.gray600,
                        ),
                      ),
                      Text(
                        statusLabel,
                        style: theme.bodySmall?.copyWith(
                          color: parent.isActive
                              ? ViroColors.success
                              : ViroColors.gray600,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const ViroRoleBadge(
                  role: ViroRole.parent,
                  compact: true,
                ),
              ],
            ),
            const SizedBox(height: ViroSpacing.sm),
            Wrap(
              spacing: ViroSpacing.xs,
              runSpacing: ViroSpacing.xs,
              children: [
                if (isPending) ...[
                  TextButton(
                    onPressed: busy ? null : onCopyInvite,
                    child: const Text('Copier'),
                  ),
                  TextButton(
                    onPressed: busy ? null : onChangeEmail,
                    child: const Text('Mail'),
                  ),
                  TextButton(
                    onPressed: busy ? null : onExtend,
                    child: const Text('Prolonger'),
                  ),
                  TextButton(
                    onPressed: busy ? null : onRegenerate,
                    child: const Text('Renvoyer'),
                  ),
                ],
                ...parent.children.map(
                  (child) => TextButton(
                    onPressed: busy ? null : () => onRevokeChild(child),
                    child: Text(
                      parent.children.length > 1
                          ? 'Révoquer (${child.displayName})'
                          : 'Révoquer',
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
