import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/invitation_service.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/invite_message.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Ouvre la feuille de partage du code d’équipe multi-usage.
Future<void> showInviteTeamSheet(
  BuildContext context, {
  required Club club,
  required ClubTeam team,
}) {
  final accent = clubAccentColor(
    brandColorHex: club.brandColorHex,
    clubId: club.id,
  );

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => ClubAccentTheme(
      accentColor: accent,
      child: InviteTeamSheet(club: club, team: team),
    ),
  );
}

/// Feuille coach : code d’équipe, partage, régénération, révocation.
class InviteTeamSheet extends ConsumerStatefulWidget {
  const InviteTeamSheet({
    super.key,
    required this.club,
    required this.team,
  });

  final Club club;
  final ClubTeam team;

  @override
  ConsumerState<InviteTeamSheet> createState() => _InviteTeamSheetState();
}

class _InviteTeamSheetState extends ConsumerState<InviteTeamSheet> {
  TeamInviteResult? _invite;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Charge le code actif (ou en crée un).
  Future<void> _load({bool forceRefresh = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final invite = await ref
          .read(invitationServiceProvider)
          .createOrRefreshTeamInvite(
            clubId: widget.club.id,
            teamId: widget.team.id,
            forceRefresh: forceRefresh,
          );
      if (!mounted) return;
      setState(() {
        _invite = invite;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(error));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copyCode() async {
    final invite = _invite;
    if (invite == null) return;
    await Clipboard.setData(ClipboardData(text: invite.code));
    if (!mounted) return;
    ViroSnackBar.show(context, AppCopy.join.teamCodeCopied);
  }

  Future<void> _shareLink() async {
    final invite = _invite;
    if (invite == null) return;
    final message = buildTeamInviteMessage(
      club: widget.club,
      teamName: invite.teamName.isNotEmpty
          ? invite.teamName
          : widget.team.name,
      code: invite.code,
      joinUrl: invite.joinUrl,
    );
    await Clipboard.setData(ClipboardData(text: message));
    if (!mounted) return;
    ViroSnackBar.show(context, AppCopy.join.teamLinkCopied);
  }

  Future<void> _revoke() async {
    final invite = _invite;
    if (invite == null) return;
    await ref.read(invitationServiceProvider).revokeTeamInvite(
          clubId: invite.clubId,
          invitationId: invite.invitationId,
        );
    if (!mounted) return;
    ViroSnackBar.show(context, AppCopy.join.teamCodeRevoked);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final invite = _invite;
    final dateLabel = invite == null
        ? ''
        : DateFormat('dd/MM/yyyy').format(invite.expiresAt.toLocal());

    return Padding(
      padding: EdgeInsets.only(
        left: ViroSpacing.lg,
        right: ViroSpacing.lg,
        top: ViroSpacing.lg,
        bottom: MediaQuery.viewInsetsOf(context).bottom + ViroSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            AppCopy.join.inviteTeamTitle,
            style: theme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: ViroSpacing.xs),
          Text(
            AppCopy.join.inviteTeamSubtitle,
            style: theme.bodyMedium?.copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: ViroSpacing.lg),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(ViroSpacing.xl),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            )
          else if (invite != null) ...[
            Text(
              invite.code,
              textAlign: TextAlign.center,
              style: theme.displaySmall?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: 4,
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              AppCopy.join.teamInviteUses(invite.useCount, invite.maxUses),
              textAlign: TextAlign.center,
              style: theme.bodyMedium,
            ),
            Text(
              AppCopy.join.teamInviteExpires(dateLabel),
              textAlign: TextAlign.center,
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
            const SizedBox(height: ViroSpacing.lg),
            ViroPrimaryButton(
              label: AppCopy.join.shareTeamCode,
              onPressed: _busy ? null : () => _run(_shareLink),
            ),
            const SizedBox(height: ViroSpacing.sm),
            ViroPrimaryButton(
              label: AppCopy.join.copyTeamCode,
              outlined: true,
              onPressed: _busy ? null : () => _run(_copyCode),
            ),
            const SizedBox(height: ViroSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: _busy
                        ? null
                        : () => _run(() => _load(forceRefresh: true)),
                    child: Text(AppCopy.join.regenerateTeamCode),
                  ),
                ),
                Expanded(
                  child: TextButton(
                    onPressed: _busy ? null : () => _run(_revoke),
                    child: Text(
                      AppCopy.join.revokeTeamCode,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
