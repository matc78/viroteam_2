import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_image_lightbox.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_selectable_row.dart';

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

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(
      text: widget.team.federation?.url ?? '',
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

  Future<void> _import() async {
    final teamKey = _selectedKey;
    if (teamKey == null) return;
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
                                  () => _selectedKey =
                                      selected ? poolTeam.key : null,
                                ),
                        ),
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
                child: ViroPrimaryButton(
                  label: AppCopy.standings.importAction,
                  isLoading: _busy,
                  onPressed: _busy ? null : _import,
                ),
              ),
          ],
        ),
      ),
    );
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
