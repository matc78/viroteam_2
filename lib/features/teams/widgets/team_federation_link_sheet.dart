import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_image_lightbox.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_selectable_row.dart';
import 'package:viro_team_v2/widgets/lists/convocation_player_list_tile.dart';

/// Ouvre la sheet de liaison d'une équipe à sa poule FFVB : lien collé,
/// vérification, choix de l'équipe dans la poule, import silencieux.
///
/// Retourne `true` si l'équipe a été liée.
Future<bool?> showTeamFederationLinkSheet(
  BuildContext context, {
  required ClubTeam team,
  required Color accent,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: context.viroPalette.surfaceCard,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(ViroSpacing.cardRadius),
      ),
    ),
    builder: (sheetContext) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
      ),
      child: _TeamFederationLinkSheet(team: team, accent: accent),
    ),
  );
}

class _TeamFederationLinkSheet extends ConsumerStatefulWidget {
  const _TeamFederationLinkSheet({required this.team, required this.accent});

  final ClubTeam team;
  final Color accent;

  @override
  ConsumerState<_TeamFederationLinkSheet> createState() =>
      _TeamFederationLinkSheetState();
}

class _TeamFederationLinkSheetState
    extends ConsumerState<_TeamFederationLinkSheet> {
  late final TextEditingController _urlController;
  FederationLinkPreview? _preview;
  String? _selectedKey;
  bool _busy = false;
  String? _error;

  /// Étape 2 : joueurs convoqués par défaut sur tous les matchs importés.
  bool _convocationStep = false;

  /// Joueurs décochés (ids de fiche), gardés si on revient à l'étape 1.
  final Set<String> _excludedIds = {};

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(
      text: widget.team.federation?.url ?? '',
    );
    // Re-liaison : reprend les convoqués par défaut mémorisés.
    _excludedIds.addAll(
      (widget.team.federation?.excludedMemberIds ?? const <String>[]).where(
        widget.team.playerIds.contains,
      ),
    );
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  /// Contrôle local rapide (le serveur revalide le lien).
  bool _looksLikeFfvbLink(String value) {
    final uri = Uri.tryParse(value.trim());
    return uri != null &&
        uri.host.toLowerCase().endsWith('ffvbbeach.org') &&
        uri.path.endsWith('vbspo_calendrier.php');
  }

  Future<void> _check() async {
    final url = _urlController.text.trim();
    if (!_looksLikeFfvbLink(url)) {
      setState(() => _error = AppCopy.standings.invalidLink);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _preview = null;
      _selectedKey = null;
    });
    try {
      final preview = await ref
          .read(teamFederationServiceProvider)
          .previewLink(
            clubId: widget.team.clubId,
            teamId: widget.team.id,
            url: url,
          );
      if (!mounted) return;
      final current = widget.team.federation?.teamKey;
      setState(() {
        _preview = preview;
        _selectedKey = preview.teams.any((team) => team.key == current)
            ? current
            : null;
      });
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = callableErrorMessage(
            error,
            fallback: AppCopy.standings.linkCheckUnavailable,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Après le choix d'équipe : étape convocations si l'équipe a des joueurs,
  /// sinon import direct.
  void _continue() {
    if (widget.team.playerIds.isEmpty) {
      _import();
      return;
    }
    setState(() {
      _convocationStep = true;
      _error = null;
    });
  }

  void _togglePlayer(String playerId, bool convoked) {
    setState(() {
      _error = null;
      if (convoked) {
        _excludedIds.remove(playerId);
      } else {
        _excludedIds.add(playerId);
      }
    });
  }

  Future<void> _import({int? playerCount}) async {
    final teamKey = _selectedKey;
    if (teamKey == null) return;
    if (playerCount != null &&
        playerCount > 0 &&
        _excludedIds.length >= playerCount) {
      setState(() => _error = AppCopy.planning.keepOnePlayerConvoked);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(teamFederationServiceProvider)
          .link(
            clubId: widget.team.clubId,
            teamId: widget.team.id,
            url: _urlController.text,
            teamKey: teamKey,
            excludedMemberIds: _convocationStep
                ? _excludedIds.toList()
                : const [],
          );
      if (!mounted) return;
      ViroSnackBar.show(context, AppCopy.standings.imported(result.created));
      Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = callableErrorMessage(
            error,
            fallback: AppCopy.standings.linkCheckUnavailable,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final preview = _preview;
    // Bouton fixe en bas uniquement après choix d'équipe (jamais grisé).
    final showImport = preview != null && _selectedKey != null;
    final players = _convocationStep
        ? ref
              .watch(clubMembersProvider(widget.team.clubId))
              .whenData(
                (members) => teamPlayerEntries([
                  widget.team,
                ], indexClubMembersById(members)),
              )
        : null;
    final playerCount = players?.value?.length;

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.lg,
                  ViroSpacing.md,
                  ViroSpacing.lg,
                  ViroSpacing.lg,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (players != null)
                      ..._convocationStepChildren(players)
                    else ...[
                      Text(
                        AppCopy.standings.sheetTitle,
                        style: theme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: palette.brandText,
                        ),
                      ),
                      const SizedBox(height: ViroSpacing.xs),
                      Text(
                        AppCopy.standings.sheetHelper,
                        style: theme.bodyMedium?.copyWith(
                          color: palette.textSecondary,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: ViroSpacing.md),
                      const _FederationPageExample(),
                      const SizedBox(height: ViroSpacing.lg),
                      TextField(
                        controller: _urlController,
                        keyboardType: TextInputType.url,
                        textInputAction: TextInputAction.done,
                        // Lien modifié : l'aperçu ne correspond plus, on revérifie.
                        onChanged: (_) {
                          if (_preview == null) return;
                          setState(() {
                            _preview = null;
                            _selectedKey = null;
                          });
                        },
                        onSubmitted: (_) => _busy ? null : _check(),
                        decoration: InputDecoration(
                          labelText: AppCopy.standings.urlLabel,
                          hintText: AppCopy.standings.urlHint,
                        ),
                      ),
                      const SizedBox(height: ViroSpacing.sm),
                      ViroPrimaryButton(
                        label: AppCopy.standings.checkLink,
                        outlined: true,
                        isLoading: _busy && preview == null,
                        onPressed: _busy ? null : _check,
                      ),
                      if (preview != null) ...[
                        const SizedBox(height: ViroSpacing.lg),
                        if (preview.poolLabel.isNotEmpty)
                          Text(
                            preview.poolLabel,
                            style: theme.bodySmall?.copyWith(
                              color: palette.textSecondary,
                            ),
                          ),
                        const SizedBox(height: ViroSpacing.xs),
                        Text(
                          AppCopy.standings.pickTeam,
                          style: theme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: palette.textPrimary,
                          ),
                        ),
                        const SizedBox(height: ViroSpacing.sm),
                        for (final poolTeam in preview.teams)
                          ViroSelectableRow(
                            selected: _selectedKey == poolTeam.key,
                            accentColor: widget.accent,
                            title: poolTeam.name,
                            onChanged: _busy
                                ? null
                                : (selected) => setState(
                                    () => _selectedKey = selected
                                        ? poolTeam.key
                                        : null,
                                  ),
                          ),
                      ],
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: ViroSpacing.sm),
                      Text(
                        _error!,
                        style: theme.bodySmall?.copyWith(
                          color: palette.errorText,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (showImport)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.lg,
                  ViroSpacing.sm,
                  ViroSpacing.lg,
                  ViroSpacing.lg,
                ),
                child: _convocationStep || widget.team.playerIds.isEmpty
                    ? ViroPrimaryButton(
                        label: AppCopy.standings.importAction,
                        isLoading: _busy,
                        onPressed:
                            _busy || (_convocationStep && playerCount == null)
                            ? null
                            : () => _import(playerCount: playerCount),
                      )
                    : ViroPrimaryButton(
                        label: AppCopy.common.continueAction,
                        onPressed: _busy ? null : _continue,
                      ),
              ),
          ],
        ),
      ),
    );
  }

  /// Étape convocations : joueurs de l'équipe, tous cochés par défaut.
  List<Widget> _convocationStepChildren(
    AsyncValue<List<({String id, ClubMember member})>> players,
  ) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.standings;
    final hintStyle = theme.bodySmall?.copyWith(
      color: palette.textSecondary,
      height: 1.35,
    );
    final entries = players.value;

    return [
      Row(
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(
              minWidth: ViroSpacing.minTouchTarget,
              minHeight: ViroSpacing.minTouchTarget,
            ),
            tooltip: AppCopy.common.back,
            icon: ViroIcon(ViroIcons.chevronLeft, color: palette.textSecondary),
            onPressed: _busy
                ? null
                : () => setState(() {
                    _convocationStep = false;
                    _error = null;
                  }),
          ),
          Expanded(
            child: Text(
              copy.convocationStepTitle,
              style: theme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: palette.brandText,
              ),
            ),
          ),
          if (entries != null && entries.isNotEmpty)
            Text(
              AppCopy.planning.convocationCount(
                entries
                    .where(
                      (p) =>
                          !_excludedIds.contains(p.id) &&
                          !widget.team.isSparring(p.id),
                    )
                    .length,
                entries.length,
              ),
              style: theme.labelMedium?.copyWith(
                color: palette.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
      const SizedBox(height: ViroSpacing.xs),
      Text(copy.convocationStepHelper, style: hintStyle),
      const SizedBox(height: ViroSpacing.xs),
      Text(
        copy.convocationStepLater,
        style: hintStyle?.copyWith(fontWeight: FontWeight.w600),
      ),
      const SizedBox(height: ViroSpacing.md),
      if (players.hasError)
        const ViroErrorState()
      else if (entries == null)
        const Padding(
          padding: EdgeInsets.all(ViroSpacing.md),
          child: Center(child: ViroLogoLoader()),
        )
      else if (entries.isEmpty)
        Text(AppCopy.planning.teamNoPlayers, style: hintStyle)
      else
        for (final entry in entries)
          ConvocationPlayerListTile(
            key: ValueKey(entry.id),
            member: entry.member,
            // Sparring : exclu d'office des matchs importés (serveur), à
            // ajouter match par match.
            convoked: !_excludedIds.contains(entry.id) &&
                !widget.team.isSparring(entry.id),
            sparring: widget.team.isSparring(entry.id),
            enabled: !_busy && !widget.team.isSparring(entry.id),
            accentColor: widget.accent,
            onChanged: (convoked) => _togglePlayer(entry.id, convoked),
          ),
    ];
  }
}

/// Vignette d'exemple de la page calendrier FFVB attendue ; tap = plein écran.
class _FederationPageExample extends StatelessWidget {
  const _FederationPageExample();

  static const _asset = 'assets/images/standings/ffvb_link_example.jpg';
  static const double _thumbnailWidth = 112;
  static const double _thumbnailHeight = 78;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final copy = AppCopy.standings;
    final radius = BorderRadius.circular(ViroSpacing.buttonRadius);

    return ViroPressable(
      floating: false,
      borderRadius: radius,
      label: copy.exampleImageLabel,
      onTap: () => showViroImageLightbox(
        context,
        imageAsset: _asset,
        semanticLabel: copy.exampleImageLabel,
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: radius,
            child: Stack(
              children: [
                Image.asset(
                  _asset,
                  width: _thumbnailWidth,
                  height: _thumbnailHeight,
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                ),
                Positioned(
                  right: ViroSpacing.xs,
                  bottom: ViroSpacing.xs,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: palette.surfaceCard,
                      shape: BoxShape.circle,
                    ),
                    child: ViroIcon(
                      ViroIcons.zoomIn,
                      size: 14,
                      color: palette.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Text(
              copy.exampleCaption,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: palette.textSecondary,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
