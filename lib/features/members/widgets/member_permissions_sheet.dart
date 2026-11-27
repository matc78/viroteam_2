import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/utils/coach_permission_labels.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/features/members/utils/permission_glyphs.dart';
import 'package:viro_team_v2/features/members/widgets/coach_rights_redirect_dialog.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_permission.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/lists/member_permission_list_tile.dart';

/// Ouvre la feuille d'attribution des droits de [member] et renvoie la liste
/// choisie (normalisée), ou `null` si annulé / inchangé.
///
/// Capacités d'équipe (lecture seule : relation coach + flags du club), puis
/// droits club éditables (admin, raccourcis, détail). L'enregistrement
/// (callable `setMemberPermissions`) reste à l'appelant.
///
/// [onEditCoachRights] (admin seulement) : un tap sur une capacité d'équipe
/// propose d'aller la régler ; sur « Go », la feuille se ferme sans rien
/// enregistrer puis le callback ouvre les paramètres du club.
Future<Set<ClubPermission>?> showMemberPermissionsSheet(
  BuildContext context, {
  required ClubMember member,
  required Color accentColor,
  required CoachPermissions coachPermissions,
  required List<String> coachedTeamNames,
  VoidCallback? onEditCoachRights,
}) {
  return showModalBottomSheet<Set<ClubPermission>>(
    context: context,
    isScrollControlled: true,
    builder: (_) => ClubAccentTheme(
      accentColor: accentColor,
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.8,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, scrollController) => MemberPermissionsSheet(
          member: member,
          accentColor: accentColor,
          coachPermissions: coachPermissions,
          coachedTeamNames: coachedTeamNames,
          scrollController: scrollController,
          onEditCoachRights: onEditCoachRights,
        ),
      ),
    ),
  );
}

/// Contenu de [showMemberPermissionsSheet] (brouillon local des droits club).
class MemberPermissionsSheet extends StatefulWidget {
  const MemberPermissionsSheet({
    super.key,
    required this.member,
    required this.accentColor,
    required this.coachPermissions,
    required this.coachedTeamNames,
    required this.scrollController,
    this.onEditCoachRights,
  });

  final ClubMember member;
  final Color accentColor;
  final CoachPermissions coachPermissions;
  final List<String> coachedTeamNames;
  final ScrollController scrollController;

  /// Voir [showMemberPermissionsSheet].
  final VoidCallback? onEditCoachRights;

  @override
  State<MemberPermissionsSheet> createState() => _MemberPermissionsSheetState();
}

class _MemberPermissionsSheetState extends State<MemberPermissionsSheet> {
  late Set<ClubPermission> _draft = {...widget.member.permissions};

  /// Accent des capacités d'équipe (distinct des droits club / couleur club).
  static const Color _teamAccent = ViroColors.sportOrange;

  bool get _isAdmin => _draft.contains(ClubPermission.admin);

  bool get _isTeamCoach => widget.member.coachTeamIds.isNotEmpty;

  /// Tap sur une capacité d'équipe : propose les paramètres du club, où se
  /// règlent les capacités de tous les coachs. Prévenir si le brouillon a
  /// des droits club non enregistrés.
  Future<void> _offerCoachRightsRedirect(VoidCallback openSettings) async {
    final go = await showCoachRightsRedirectDialog(
      context,
      discardUnsavedChanges: _changed,
    );
    if (!go || !mounted) return;
    Navigator.pop(context);
    openSettings();
  }

  bool get _changed {
    final before = ClubPermission.normalize(widget.member.permissions);
    final after = ClubPermission.normalize(_draft);
    return before.length != after.length ||
        before.any((permission) => !after.contains(permission));
  }

  void _toggleFunction(ClubFunction function, bool enabled) {
    setState(() {
      _draft = enabled
          ? {..._draft, ...function.permissions}
          : _draft.difference(function.permissions);
    });
  }

  void _togglePermission(ClubPermission permission, bool enabled) {
    setState(() {
      _draft = enabled
          ? {..._draft, permission, ...permission.implied}
          : ({..._draft}..remove(permission));
    });
  }

  /// Droit coché du brouillon qui implique [permission] (ex. `manageFees`
  /// pour `viewFees`), ou `null` : la case est alors cochée et figée.
  ClubPermission? _impliedBy(ClubPermission permission) {
    for (final granted in _draft) {
      if (granted.implied.contains(permission)) return granted;
    }
    return null;
  }

  /// Sous-titre d'un droit : description, ou mention « inclus avec … ».
  String _permissionSubtitle(
    AppCopyPermissions copy,
    ClubPermission permission,
  ) {
    final implier = _isAdmin ? null : _impliedBy(permission);
    if (implier == null) return copy.permissionDescription(permission);
    return '${copy.permissionDescription(permission)} '
        '${copy.impliedBy(implier)}';
  }

  /// Sous-titre d'un raccourci : description + « En partie » si besoin.
  String _functionSubtitle(AppCopyPermissions copy, ClubFunction function) {
    final description = copy.functionDescription(function);
    if (function.isPartiallyGranted(_draft)) {
      if (description.isEmpty) return copy.functionPartial;
      return '$description · ${copy.functionPartial}';
    }
    return description;
  }

  @override
  Widget build(BuildContext context) {
    final copy = AppCopy.permissions;
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final accent = widget.accentColor;
    final readOnly = _isAdmin;
    final openCoachSettings = widget.onEditCoachRights;
    final activeCoachFlags = [
      for (final entry in coachPermissionLabels)
        if (widget.coachPermissions.allows(entry.flag)) entry,
    ];

    Widget sectionLabel(String label, {required Color color}) => Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
      child: Text(
        label.toUpperCase(),
        style: theme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
    );

    Widget sectionCard({
      required Color borderColor,
      required Color fillColor,
      required List<Widget> children,
    }) => Material(
      color: fillColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        side: BorderSide(color: borderColor),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ViroSpacing.md,
          ViroSpacing.sm,
          ViroSpacing.md,
          ViroSpacing.sm,
        ),
        child: SizedBox(
          width: double.infinity,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children,
          ),
        ),
      ),
    );

    return Material(
      color: palette.surfaceCard,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Expanded(
            child: ListView(
              controller: widget.scrollController,
              padding: const EdgeInsets.fromLTRB(
                ViroSpacing.lg,
                ViroSpacing.lg,
                ViroSpacing.lg,
                ViroSpacing.md,
              ),
              children: [
                Text(
                  copy.rightsOf(widget.member.fullName),
                  style: theme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.brandText,
                  ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  copy.rightsIntro,
                  style: theme.bodySmall?.copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                const SizedBox(height: ViroSpacing.lg),
                sectionCard(
                  borderColor: _teamAccent.withValues(alpha: 0.45),
                  fillColor: _teamAccent.withValues(alpha: 0.1),
                  children: [
                    sectionLabel(
                      copy.teamCapabilitiesSection,
                      color: _teamAccent,
                    ),
                    Text(
                      copy.teamCapabilitiesHelper,
                      style: theme.bodySmall?.copyWith(
                        color: palette.textMuted,
                      ),
                    ),
                    const SizedBox(height: ViroSpacing.sm),
                    if (!_isTeamCoach)
                      Text(
                        copy.teamCapabilitiesEmpty,
                        style: theme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                      )
                    else ...[
                      if (widget.coachedTeamNames.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(
                            bottom: ViroSpacing.xs,
                          ),
                          child: Text(
                            copy.coachedTeamsLabel(
                              widget.coachedTeamNames.join(', '),
                            ),
                            style: theme.bodySmall?.copyWith(
                              color: palette.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      for (final entry in activeCoachFlags)
                        Padding(
                          padding: const EdgeInsets.only(
                            bottom: ViroSpacing.xs,
                          ),
                          child: MemberPermissionListTile(
                            title: entry.label,
                            subtitle: entry.description,
                            value: true,
                            accentColor: _teamAccent,
                            onChanged: null,
                            onLockedTap: openCoachSettings == null
                                ? null
                                : () => _offerCoachRightsRedirect(
                                    openCoachSettings,
                                  ),
                          ),
                        ),
                    ],
                  ],
                ),
                const SizedBox(height: ViroSpacing.lg),
                sectionLabel(copy.clubRightsSection, color: accent),
                const SizedBox(height: ViroSpacing.sm),
                sectionLabel(copy.adminSection, color: ViroColors.error),
                MemberPermissionListTile(
                  title: copy.permissionLabel(ClubPermission.admin),
                  subtitle: copy.adminWarning,
                  value: _isAdmin,
                  accentColor: ViroColors.error,
                  glyph: glyphOfPermission(ClubPermission.admin),
                  onChanged: (enabled) =>
                      _togglePermission(ClubPermission.admin, enabled),
                ),
                const SizedBox(height: ViroSpacing.lg),
                sectionLabel(copy.functionsSection, color: accent),
                Text(
                  copy.functionsHelper,
                  style: theme.bodySmall?.copyWith(color: palette.textMuted),
                ),
                const SizedBox(height: ViroSpacing.sm),
                _TwoColumnGrid(
                  children: [
                    for (final function in ClubFunction.values)
                      MemberPermissionListTile(
                        compact: true,
                        title: copy.functionLabel(function),
                        subtitle: _functionSubtitle(copy, function),
                        glyph: glyphOfFunction(function),
                        value: function.isFullyGranted(_draft)
                            ? true
                            : function.isPartiallyGranted(_draft)
                            ? null
                            : false,
                        accentColor: accent,
                        onChanged: readOnly
                            ? null
                            : (enabled) => _toggleFunction(function, enabled),
                      ),
                  ],
                ),
                const SizedBox(height: ViroSpacing.md),
                sectionLabel(copy.detailSection, color: accent),
                Text(
                  copy.detailHelper,
                  style: theme.bodySmall?.copyWith(color: palette.textMuted),
                ),
                const SizedBox(height: ViroSpacing.sm),
                for (final permission in ClubPermission.values)
                  if (permission != ClubPermission.admin)
                    Padding(
                      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
                      child: MemberPermissionListTile(
                        title: copy.permissionLabel(permission),
                        subtitle: _permissionSubtitle(copy, permission),
                        glyph: glyphOfPermission(permission),
                        value:
                            _isAdmin ||
                            _draft.contains(permission) ||
                            _impliedBy(permission) != null,
                        accentColor: accent,
                        onChanged: readOnly || _impliedBy(permission) != null
                            ? null
                            : (enabled) =>
                                  _togglePermission(permission, enabled),
                      ),
                    ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                ViroSpacing.lg,
                ViroSpacing.sm,
                ViroSpacing.lg,
                ViroSpacing.md,
              ),
              child: ElevatedButton(
                onPressed: _changed
                    ? () => Navigator.pop(
                        context,
                        ClubPermission.normalize(_draft).toSet(),
                      )
                    : null,
                child: Text(copy.save),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Grille de deux colonnes à hauteur égale par rangée ; un élément seul en
/// fin de liste prend toute la largeur.
class _TwoColumnGrid extends StatelessWidget {
  const _TwoColumnGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var index = 0; index < children.length; index += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
            child: index + 1 < children.length
                ? IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(child: children[index]),
                        const SizedBox(width: ViroSpacing.sm),
                        Expanded(child: children[index + 1]),
                      ],
                    ),
                  )
                : children[index],
          ),
      ],
    );
  }
}
