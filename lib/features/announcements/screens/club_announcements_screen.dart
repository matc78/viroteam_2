import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/announcements/providers/announcement_providers.dart';
import 'package:viro_team_v2/features/announcements/widgets/announcement_history_card.dart';
import 'package:viro_team_v2/features/announcements/widgets/announcement_message_sheet.dart';
import 'package:viro_team_v2/features/announcements/widgets/create_announcement_sheet.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club_announcement.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

class ClubAnnouncementsScreen extends ConsumerStatefulWidget {
  const ClubAnnouncementsScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubAnnouncementsScreen> createState() =>
      _ClubAnnouncementsScreenState();
}

class _ClubAnnouncementsScreenState
    extends ConsumerState<ClubAnnouncementsScreen> {
  /// Section « Clôturées » repliée par défaut : l'historique reste à portée
  /// sans noyer les annonces en cours.
  var _showClosed = false;

  String get clubId => widget.clubId;

  @override
  Widget build(BuildContext context) {
    final sectionsAsync = ref.watch(clubAnnouncementSectionsProvider(clubId));
    final memberAsync = ref.watch(clubMemberProvider(clubId));
    final teamsAsync = ref.watch(clubTeamsProvider(clubId));
    final canManage = memberAsync.maybeWhen(
      data: (m) => m != null && MemberRoleHierarchy.isCoachOrAbove(m.role),
      orElse: () => false,
    );
    final accent = ref.watch(clubMemberAccentProvider(clubId));

    final teamNames = <String, String>{
      for (final t in teamsAsync.value ?? []) t.id: t.name,
    };

    Widget cardFor(ClubAnnouncement announcement) => AnnouncementHistoryCard(
      announcement: announcement,
      targetLabel: announcement.targetLabel(teamNamesById: teamNames),
      accentColor: accent,
      canManage: canManage,
      onTap: () =>
          showAnnouncementMessageSheet(context, announcement: announcement),
      onEdit: () => showEditAnnouncementSheet(
        context,
        ref,
        clubId: clubId,
        announcement: announcement,
      ),
      onClose: announcement.isActive ? () => _confirmClose(announcement) : null,
      onDelete: () => _confirmDelete(announcement),
    );

    return ClubAccentTheme(
      accentColor: accent,
      child: ViroScaffold(
        fallbackRoute: AppRoutes.clubDetailPath(clubId),
        appBar: ViroAppBar(
          title: Text(AppCopy.announcements.screenTitle),
          fallbackRoute: AppRoutes.clubDetailPath(clubId),
        ),
        floatingActionButton: canManage
            ? FloatingActionButton.extended(
                onPressed: _openCreateSheet,
                icon: ViroIcon(ViroIcons.add, color: ViroColors.white),
                label: Text(AppCopy.announcements.newAnnouncementFab),
              )
            : null,
        body: sectionsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => ViroErrorState(
            onRetry: () => ref.invalidate(clubAnnouncementsProvider(clubId)),
          ),
          data: (sections) {
            final isEmpty = sections.active.isEmpty && sections.closed.isEmpty;
            return ViroRefreshIndicator(
              onRefresh: () async {
                await Future.wait([
                  ref.refresh(clubAnnouncementsProvider(clubId).future),
                  ref.refresh(clubMemberProvider(clubId).future),
                  ref.refresh(clubTeamsProvider(clubId).future),
                ]);
              },
              child: isEmpty
                  ? ListView(
                      physics: ViroRefreshIndicator.scrollPhysics,
                      children: [
                        SizedBox(
                          height: MediaQuery.sizeOf(context).height * 0.6,
                          child: ViroEmptyState(
                            message: AppCopy.announcements.empty,
                            icon: ViroIcons.bell,
                            actionLabel: canManage
                                ? AppCopy.announcements.publishAnnouncementCta
                                : null,
                            onAction: canManage ? _openCreateSheet : null,
                          ),
                        ),
                      ],
                    )
                  : CustomScrollView(
                      physics: ViroRefreshIndicator.scrollPhysics,
                      slivers: [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(
                            ViroSpacing.screenHorizontal,
                            ViroSpacing.screenHorizontal,
                            ViroSpacing.screenHorizontal,
                            0,
                          ),
                          sliver: sections.active.isEmpty
                              ? SliverToBoxAdapter(
                                  child: _AnnouncementsEmptyActiveHint(),
                                )
                              : SliverList.builder(
                                  itemCount: sections.active.length,
                                  itemBuilder: (_, i) =>
                                      cardFor(sections.active[i]),
                                ),
                        ),
                        if (sections.closed.isNotEmpty) ...[
                          SliverToBoxAdapter(
                            child: _ClosedSectionHeader(
                              count: sections.closed.length,
                              expanded: _showClosed,
                              onToggle: () =>
                                  setState(() => _showClosed = !_showClosed),
                            ),
                          ),
                          if (_showClosed)
                            SliverPadding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: ViroSpacing.screenHorizontal,
                              ),
                              sliver: SliverList.builder(
                                itemCount: sections.closed.length,
                                itemBuilder: (_, i) =>
                                    cardFor(sections.closed[i]),
                              ),
                            ),
                        ],
                        // Dégage le FAB en bas de liste.
                        const SliverToBoxAdapter(
                          child: SizedBox(height: ViroSpacing.xl * 2),
                        ),
                      ],
                    ),
            );
          },
        ),
      ),
    );
  }

  void _openCreateSheet() {
    showCreateAnnouncementSheet(context, ref, clubId: clubId);
  }

  Future<void> _confirmClose(ClubAnnouncement announcement) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Theme(
        data: Theme.of(context),
        child: AlertDialog(
          title: Text(AppCopy.announcements.closeConfirmTitle),
          content: Text(AppCopy.announcements.closeConfirmBody),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(AppCopy.common.cancel),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(AppCopy.announcements.closeAction),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    final auth = ref.read(authStateProvider).value;
    if (auth == null) {
      ViroSnackBar.show(context, AppCopy.common.sessionExpired);
      return;
    }

    try {
      await ref
          .read(announcementServiceProvider)
          .closeAnnouncement(
            clubId: clubId,
            announcementId: announcement.id,
            closedBy: auth.uid,
          );
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.announcements.announceClosed);
      }
    } catch (e) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
      }
    }
  }

  Future<void> _confirmDelete(ClubAnnouncement announcement) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Theme(
        data: Theme.of(context),
        child: AlertDialog(
          title: Text(AppCopy.announcements.deleteConfirmTitle),
          content: Text(AppCopy.announcements.deleteConfirmBody),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(AppCopy.common.cancel),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(
                AppCopy.common.delete,
                style: TextStyle(color: ctx.viroPalette.errorText),
              ),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await ref
          .read(announcementServiceProvider)
          .deleteAnnouncement(clubId: clubId, announcementId: announcement.id);
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.announcements.announceDeleted);
      }
    } catch (e) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
      }
    }
  }
}

/// Rappel discret quand il ne reste que des annonces clôturées.
class _AnnouncementsEmptyActiveHint extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.md),
      child: Text(
        AppCopy.announcements.emptyActive,
        style: Theme.of(
          context,
        ).textTheme.bodyMedium?.copyWith(color: context.viroPalette.textMuted),
      ),
    );
  }
}

/// En-tête repliable de la section des annonces clôturées / expirées.
class _ClosedSectionHeader extends StatelessWidget {
  const _ClosedSectionHeader({
    required this.count,
    required this.expanded,
    required this.onToggle,
  });

  final int count;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
      ),
      child: ViroPressable(
        onTap: onToggle,
        floating: false,
        label: expanded
            ? AppCopy.announcements.hideClosed
            : AppCopy.announcements.showClosed,
        child: Row(
          children: [
            Expanded(
              child: Text(
                AppCopy.announcements.closedSectionTitle(count),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: palette.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            ViroIcon(
              expanded ? ViroIcons.chevronUp : ViroIcons.chevronDown,
              size: 20,
              color: palette.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
