import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/widgets/lists/club_list_tile.dart';

/// Feuille « Quel club ? » : choisit le club dont ouvrir le planning complet
/// (état vide du planning membre quand on a plusieurs clubs).
Future<void> showClubPlanningPickerSheet(
  BuildContext context, {
  required List<UserClubEntry> clubs,
}) {
  final palette = context.viroPalette;
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: palette.surfaceCard,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(ViroSpacing.cardRadius),
      ),
    ),
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ViroSpacing.lg,
          ViroSpacing.lg,
          ViroSpacing.lg,
          ViroSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AppCopy.planning.pickClubPlanningTitle,
              style: Theme.of(sheetContext).textTheme.titleMedium?.copyWith(
                    color: palette.brandText,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: ViroSpacing.md),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: clubs.length,
                itemBuilder: (_, index) => ClubListTile(
                  club: clubs[index].club,
                  membership: clubs[index].membership,
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    context.push(
                      AppRoutes.clubPlanningPath(clubs[index].club.id),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
