import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/compare_team_categories.dart';
import 'package:viro_team_v2/widgets/common/club_audience_scope_picker.dart';
import 'package:viro_team_v2/widgets/common/club_chip.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Résultat du dialog de création de canal admin.
final class CreateChannelDialogResult {
  const CreateChannelDialogResult({
    required this.clubId,
    required this.scopeType,
    required this.scopeIds,
    required this.title,
  });

  final String clubId;
  final String scopeType;
  final List<String> scopeIds;
  final String title;
}

/// Dialog admin : club (si multi) + cibles catégories / équipes / parents.
class CreateChannelDialog extends ConsumerStatefulWidget {
  const CreateChannelDialog({
    super.key,
    required this.adminClubs,
    this.initialClubId,
  });

  final List<Club> adminClubs;
  final String? initialClubId;

  /// Affiche le dialog ; [adminClubs] doit être non vide.
  static Future<CreateChannelDialogResult?> show(
    BuildContext context, {
    required List<Club> adminClubs,
    String? initialClubId,
  }) {
    if (adminClubs.isEmpty) return Future.value(null);
    return showDialog<CreateChannelDialogResult>(
      context: context,
      builder: (ctx) => CreateChannelDialog(
        adminClubs: adminClubs,
        initialClubId: initialClubId,
      ),
    );
  }

  @override
  ConsumerState<CreateChannelDialog> createState() =>
      _CreateChannelDialogState();
}

class _CreateChannelDialogState extends ConsumerState<CreateChannelDialog> {
  final _titleController = TextEditingController();
  late String _clubId;
  ClubAudienceScopeSelection _scope = const ClubAudienceScopeSelection(
    kind: ClubAudienceScopeKind.categories,
    ids: {},
  );

  @override
  void initState() {
    super.initState();
    final initial = widget.initialClubId;
    _clubId = initial != null &&
            widget.adminClubs.any((club) => club.id == initial)
        ? initial
        : widget.adminClubs.first.id;
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Club get _selectedClub =>
      widget.adminClubs.firstWhere((club) => club.id == _clubId);

  String _scopeTypeApi(ClubAudienceScopeKind kind) {
    return switch (kind) {
      ClubAudienceScopeKind.categories => 'categories',
      ClubAudienceScopeKind.teams => 'teams',
      ClubAudienceScopeKind.parents => 'parents',
    };
  }

  String _suggestedTitle(List<ClubTeam> teams) {
    if (_scope.ids.isEmpty) return '';
    if (_scope.kind == ClubAudienceScopeKind.categories) {
      return sortTeamCategories(
        _scope.ids,
        sport: _selectedClub.sport,
      ).join(' · ');
    }
    final teamById = {for (final team in teams) team.id: team};
    final names = _scope.ids
        .map((id) => teamById[id]?.name)
        .whereType<String>()
        .toList();
    if (_scope.kind == ClubAudienceScopeKind.parents) {
      return names.isEmpty ? '' : 'Parents · ${names.join(' · ')}';
    }
    return names.join(' · ');
  }

  Color _clubColor(Club club) {
    return resolveClubBrandColors(
      brandColorHex: club.brandColorHex,
      clubId: club.id,
    ).primary;
  }

  void _selectClub(String clubId) {
    if (clubId == _clubId) return;
    setState(() {
      _clubId = clubId;
      _scope = const ClubAudienceScopeSelection(
        kind: ClubAudienceScopeKind.categories,
        ids: {},
      );
      _titleController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final teamsAsync = ref.watch(clubTeamsProvider(_clubId));
    final multiClub = widget.adminClubs.length > 1;

    return AlertDialog(
      title: Text(AppCopy.chat.createCategoryChannel),
      content: SizedBox(
        width: 360,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(AppCopy.chat.categoryChannelHint),
              const SizedBox(height: ViroSpacing.md),
              if (!multiClub)
                Center(
                  child: ClubChip(
                    label: _selectedClub.name,
                    color: _clubColor(_selectedClub),
                    filled: true,
                  ),
                )
              else
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: ViroSpacing.sm,
                  runSpacing: ViroSpacing.sm,
                  children: [
                    for (final club in widget.adminClubs)
                      ViroPressable(
                        onTap: () => _selectClub(club.id),
                        child: AnimatedOpacity(
                          duration: const Duration(milliseconds: 150),
                          opacity: club.id == _clubId ? 1 : 0.65,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              boxShadow: club.id == _clubId
                                  ? [
                                      BoxShadow(
                                        color: _clubColor(club)
                                            .withValues(alpha: 0.35),
                                        blurRadius: 0,
                                        spreadRadius: 2,
                                      ),
                                    ]
                                  : null,
                            ),
                            child: ClubChip(
                              label: club.name,
                              color: _clubColor(club),
                              filled: true,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              const SizedBox(height: ViroSpacing.md),
              Text(
                AppCopy.chat.channelAudienceLabel,
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: ViroSpacing.sm),
              teamsAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(ViroSpacing.lg),
                  child: Center(child: ViroLogoLoader(size: 36)),
                ),
                error: (_, __) => Text(AppCopy.chat.noTeamsForChannel),
                data: (teams) {
                  final suggested = _suggestedTitle(teams);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ClubAudienceScopePicker(
                        teams: teams,
                        sport: _selectedClub.sport,
                        accentColor: _clubColor(_selectedClub),
                        value: _scope,
                        onChanged: (next) => setState(() => _scope = next),
                      ),
                      const SizedBox(height: ViroSpacing.md),
                      TextField(
                        controller: _titleController,
                        decoration: InputDecoration(
                          labelText: AppCopy.chat.channelTitleHint,
                          hintText: suggested.isEmpty ? null : suggested,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(AppCopy.common.cancel),
        ),
        TextButton(
          onPressed: _scope.ids.isEmpty
              ? null
              : () {
                  final teams =
                      ref.read(clubTeamsProvider(_clubId)).value ??
                          const <ClubTeam>[];
                  final suggested = _suggestedTitle(teams);
                  final title = _titleController.text.trim().isEmpty
                      ? suggested
                      : _titleController.text.trim();
                  if (title.isEmpty) return;
                  Navigator.pop(
                    context,
                    CreateChannelDialogResult(
                      clubId: _clubId,
                      scopeType: _scopeTypeApi(_scope.kind),
                      scopeIds: _scope.ids.toList(),
                      title: title,
                    ),
                  );
                },
          child: Text(AppCopy.chat.createChannel),
        ),
      ],
    );
  }
}
