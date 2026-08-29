import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/announcements/providers/announcement_providers.dart';
import 'package:viro_team_v2/features/announcements/widgets/announcement_message_sheet.dart';
import 'package:viro_team_v2/features/announcements/widgets/create_announcement_sheet.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club_announcement.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class ClubAnnouncementsScreen extends ConsumerWidget {
  const ClubAnnouncementsScreen({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final announcementsAsync = ref.watch(visibleClubAnnouncementsProvider(clubId));
    final memberAsync = ref.watch(clubMemberProvider(clubId));
    final teamsAsync = ref.watch(clubTeamsProvider(clubId));
    final canManage = memberAsync.maybeWhen(
      data: (m) =>
          m != null && MemberRoleHierarchy.isCoachOrAbove(m.role),
      orElse: () => false,
    );
    final accent = ref.watch(clubMemberAccentProvider(clubId));

    final teamNames = <String, String>{
      for (final t in teamsAsync.value ?? []) t.id: t.name,
    };

    return ClubAccentTheme(
      accentColor: accent,
      child: ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Annonces'),
        onTitleTap: () => Navigator.pop(context),
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: () =>
                  showCreateAnnouncementSheet(context, ref, clubId: clubId),
              icon: ViroIcon(ViroIcons.add, color: ViroColors.white),
              label: const Text('Nouvelle annonce'),
            )
          : null,
      body: announcementsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => const ViroErrorState(),
        data: (announcements) {
          return ViroRefreshIndicator(
            onRefresh: () async {
              await Future.wait([
                ref.refresh(clubAnnouncementsProvider(clubId).future),
                ref.refresh(clubMemberProvider(clubId).future),
                ref.refresh(clubTeamsProvider(clubId).future),
              ]);
            },
            child: announcements.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(ViroSpacing.xl),
                    children: [
                      SizedBox(
                        height: MediaQuery.sizeOf(context).height * 0.4,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            ViroIcon(
                              ViroIcons.bell,
                              size: 48,
                              color: accent.withValues(alpha: 0.35),
                            ),
                            const SizedBox(height: ViroSpacing.md),
                            Text(
                              'Aucune annonce pour le moment',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyLarge
                                  ?.copyWith(color: ViroColors.gray400),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding:
                        const EdgeInsets.all(ViroSpacing.screenHorizontal),
                    itemCount: announcements.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: ViroSpacing.sm),
                    itemBuilder: (context, index) {
                      final announcement = announcements[index];
                      return _AnnouncementHistoryCard(
                        announcement: announcement,
                        targetLabel: announcement.targetLabel(
                          teamNamesById: teamNames,
                        ),
                        accentColor: accent,
                        canManage: canManage,
                        onTap: () => showAnnouncementMessageSheet(
                          context,
                          announcement: announcement,
                        ),
                        onEdit: () =>
                            _showEditDialog(context, ref, announcement),
                        onClose: announcement.isActive
                            ? () => _confirmClose(context, ref, announcement)
                            : null,
                        onDelete: () =>
                            _confirmDelete(context, ref, announcement),
                      );
                    },
                  ),
          );
        },
      ),
      ),
    );
  }

  Future<void> _showEditDialog(
    BuildContext context,
    WidgetRef ref,
    ClubAnnouncement announcement,
  ) async {
    final controller = TextEditingController(text: announcement.message);

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => Theme(
        data: Theme.of(context),
        child: AlertDialog(
        title: const Text('Modifier l\'annonce'),
        content: TextField(
          controller: controller,
          maxLines: 5,
          decoration: const InputDecoration(labelText: 'Message'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Enregistrer'),
          ),
        ],
        ),
      ),
    );

    if (saved != true || !context.mounted) return;

    try {
      await ref.read(announcementServiceProvider).updateAnnouncement(
            clubId: clubId,
            announcementId: announcement.id,
            message: controller.text,
          );
      if (context.mounted) {
        ViroSnackBar.show(context, 'Annonce mise à jour.');
      }
    } catch (e) {
      if (context.mounted) {
        ViroSnackBar.show(context, 'Erreur : $e');
      }
    } finally {
      controller.dispose();
    }
  }

  Future<void> _confirmClose(
    BuildContext context,
    WidgetRef ref,
    ClubAnnouncement announcement,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Theme(
        data: Theme.of(context),
        child: AlertDialog(
        title: const Text('Clôturer l\'annonce ?'),
        content: const Text(
          'Elle ne sera plus visible pour les destinataires, mais restera dans l\'historique.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clôturer'),
          ),
        ],
        ),
      ),
    );

    if (confirmed != true || !context.mounted) return;

    final auth = ref.read(authStateProvider).value;
    if (auth == null) {
      ViroSnackBar.show(context, 'Session expirée, reconnectez-vous.');
      return;
    }

    try {
      await ref.read(announcementServiceProvider).closeAnnouncement(
            clubId: clubId,
            announcementId: announcement.id,
            closedBy: auth.uid,
          );
      if (context.mounted) {
        ViroSnackBar.show(context, 'Annonce clôturée.');
      }
    } catch (e) {
      if (context.mounted) {
        ViroSnackBar.show(context, 'Erreur : $e');
      }
    }
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    ClubAnnouncement announcement,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Theme(
        data: Theme.of(context),
        child: AlertDialog(
        title: const Text('Supprimer l\'annonce ?'),
        content: const Text(
          'Cette annonce sera définitivement supprimée pour tous les membres.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              'Supprimer',
              style: TextStyle(color: ViroColors.error),
            ),
          ),
        ],
        ),
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(announcementServiceProvider).deleteAnnouncement(
            clubId: clubId,
            announcementId: announcement.id,
          );
      if (context.mounted) {
        ViroSnackBar.show(context, 'Annonce supprimée.');
      }
    } catch (e) {
      if (context.mounted) {
        ViroSnackBar.show(context, 'Erreur : $e');
      }
    }
  }
}

class _AnnouncementHistoryCard extends StatelessWidget {
  const _AnnouncementHistoryCard({
    required this.announcement,
    required this.targetLabel,
    required this.accentColor,
    required this.canManage,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
    this.onClose,
  });

  final ClubAnnouncement announcement;
  final String targetLabel;
  final Color accentColor;
  final bool canManage;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return ViroCard(
      onTap: onTap,
      accentColor: accentColor,
      borderColor: ClubAccentStyle(accentColor).border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ViroIcon(ViroIcons.bell, size: 16, color: accentColor),
              const SizedBox(width: ViroSpacing.xs),
              Expanded(
                child: Text(
                  announcement.authorName,
                  style: theme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: accentColor,
                  ),
                ),
              ),
              Text(
                formatRelativeDate(announcement.createdAt),
                style: theme.bodySmall?.copyWith(color: ViroColors.gray400),
              ),
              if (canManage)
                PopupMenuButton<String>(
                  icon: ViroIcon(ViroIcons.moreVertical, size: 20),
                  onSelected: (value) {
                    switch (value) {
                      case 'edit':
                        onEdit();
                      case 'close':
                        onClose?.call();
                      case 'delete':
                        onDelete();
                    }
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(
                      value: 'edit',
                      child: Text('Modifier'),
                    ),
                    if (onClose != null)
                      const PopupMenuItem(
                        value: 'close',
                        child: Text('Clôturer'),
                      ),
                    const PopupMenuItem(
                      value: 'delete',
                      child: Text('Supprimer'),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: ViroSpacing.xs),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.sm,
              vertical: 2,
            ),
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              targetLabel,
              style: theme.labelSmall?.copyWith(
                color: accentColor,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (announcement.endsAt != null) ...[
            const SizedBox(height: ViroSpacing.xs),
            Text(
              'Jusqu’au ${DateFormat('d MMM yyyy HH:mm', 'fr_FR').format(announcement.endsAt!)}'
              '${announcement.closedAt != null ? ' · Clôturée' : ''}',
              style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
            ),
          ] else if (announcement.closedAt != null) ...[
            const SizedBox(height: ViroSpacing.xs),
            Text(
              'Clôturée',
              style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
            ),
          ],
          const SizedBox(height: ViroSpacing.sm),
          Text(
            announcement.message,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: theme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
