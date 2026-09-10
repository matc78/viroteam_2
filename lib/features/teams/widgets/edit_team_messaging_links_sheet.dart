import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Ouvre la sheet d'édition des liens de discussion d'une équipe.
Future<bool?> showEditTeamMessagingLinksSheet(
  BuildContext context, {
  required ClubTeam team,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: ViroColors.surfaceCard,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(ViroSpacing.cardRadius),
      ),
    ),
    builder: (sheetContext) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
      ),
      child: _EditTeamMessagingLinksSheet(team: team),
    ),
  );
}

class _EditTeamMessagingLinksSheet extends ConsumerStatefulWidget {
  const _EditTeamMessagingLinksSheet({required this.team});

  final ClubTeam team;

  @override
  ConsumerState<_EditTeamMessagingLinksSheet> createState() =>
      _EditTeamMessagingLinksSheetState();
}

class _EditTeamMessagingLinksSheetState
    extends ConsumerState<_EditTeamMessagingLinksSheet> {
  late final TextEditingController _teamLinkController;
  late final TextEditingController _parentsLinkController;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _teamLinkController = TextEditingController(
      text: widget.team.messagingLink ?? '',
    );
    _parentsLinkController = TextEditingController(
      text: widget.team.parentsMessagingLink ?? '',
    );
  }

  @override
  void dispose() {
    _teamLinkController.dispose();
    _parentsLinkController.dispose();
    super.dispose();
  }

  static const _whatsappHosts = {
    'chat.whatsapp.com',
    'wa.me',
    'www.wa.me',
    'api.whatsapp.com',
    'whatsapp.com',
    'www.whatsapp.com',
    'call.whatsapp.com',
  };

  /// Retourne une erreur si [value] n'est pas une URL WhatsApp valide.
  String? _whatsappUrlError(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    final uri = Uri.tryParse(trimmed);
    if (uri == null ||
        !uri.hasScheme ||
        (uri.scheme != 'http' && uri.scheme != 'https') ||
        uri.host.isEmpty) {
      return AppCopy.teams.whatsappLinkInvalid;
    }
    final host = uri.host.toLowerCase();
    if (!_whatsappHosts.contains(host)) {
      return AppCopy.teams.whatsappLinkOnly;
    }
    return null;
  }

  Future<void> _save() async {
    final teamLinkError = _whatsappUrlError(_teamLinkController.text);
    final parentsLinkError = _whatsappUrlError(_parentsLinkController.text);
    if (teamLinkError != null || parentsLinkError != null) {
      setState(() => _error = teamLinkError ?? parentsLinkError);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(teamServiceProvider).updateTeamMessagingLinks(
            clubId: widget.team.clubId,
            teamId: widget.team.id,
            messagingLink: _teamLinkController.text,
            parentsMessagingLink: _parentsLinkController.text,
          );
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.teams.linksUpdated);
        Navigator.of(context).pop(true);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppCopy.common.saveFailed);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return SafeArea(
      child: Padding(
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
              AppCopy.teams.messagingLinksTitle,
              style: theme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: ViroColors.primary800,
              ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Text(
              AppCopy.teams.messagingLinksHelper,
              style: theme.bodyMedium?.copyWith(
                color: ViroColors.gray600,
                height: 1.35,
              ),
            ),
            const SizedBox(height: ViroSpacing.lg),
            TextField(
              controller: _teamLinkController,
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: AppCopy.teams.teamGroupLabel,
                hintText: AppCopy.teams.whatsappLinkHint,
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
            TextField(
              controller: _parentsLinkController,
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _saving ? null : _save(),
              decoration: InputDecoration(
                labelText: AppCopy.teams.parentsGroupLabel,
                hintText: AppCopy.teams.whatsappLinkHint,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: ViroSpacing.sm),
              Text(
                _error!,
                style: theme.bodySmall?.copyWith(color: ViroColors.error),
              ),
            ],
            const SizedBox(height: ViroSpacing.lg),
            ViroPrimaryButton(
              label: AppCopy.common.save,
              isLoading: _saving,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
