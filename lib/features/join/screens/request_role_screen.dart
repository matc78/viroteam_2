import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/join/providers/pending_invitation_provider.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class RequestRoleScreen extends ConsumerStatefulWidget {
  const RequestRoleScreen({super.key});

  @override
  ConsumerState<RequestRoleScreen> createState() => _RequestRoleScreenState();
}

class _RequestRoleScreenState extends ConsumerState<RequestRoleScreen> {
  String _roleRequested = MemberRoles.coach;
  final _messageController = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final pending = ref.read(pendingInvitationProvider);
    final user = ref.read(viroUserProvider).value;
    if (!pending.hasInvitation || user == null) return;

    final currentRole = pending.invitation!.role;
    if (currentRole == _roleRequested) {
      ViroSnackBar.show(context, AppCopy.join.chooseDifferentRole);
      return;
    }

    setState(() => _loading = true);
    try {
      await ref.read(joinRequestServiceProvider).createRoleChangeRequest(
            user: user,
            club: pending.club!,
            currentRole: currentRole,
            roleRequested: _roleRequested,
            message: _messageController.text.trim(),
          );
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.join.requestSent);
        context.go(AppRoutes.joinPreview);
      }
    } catch (e) {
      if (mounted) {
        ViroSnackBar.show(context, e.toString());
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = ref.watch(pendingInvitationProvider);

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: Text(AppCopy.join.requestRoleTitle),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(AppCopy.join.requestRoleSubtitle),
              const SizedBox(height: ViroSpacing.lg),
              DropdownButtonFormField<String>(
                initialValue: _roleRequested,
                decoration: InputDecoration(
                  labelText: AppCopy.join.desiredRole,
                ),
                items: [
                  DropdownMenuItem(
                    value: MemberRoles.player,
                    child: Text(AppCopy.common.rolePlayer),
                  ),
                  DropdownMenuItem(
                    value: MemberRoles.coach,
                    child: Text(AppCopy.common.roleCoach),
                  ),
                ],
                onChanged: pending.hasInvitation
                    ? (v) {
                        if (v != null) setState(() => _roleRequested = v);
                      }
                    : null,
              ),
              const SizedBox(height: ViroSpacing.md),
              TextField(
                controller: _messageController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: AppCopy.join.optionalMessage,
                ),
              ),
              const Spacer(),
              ViroPrimaryButton(
                label: AppCopy.join.sendRequest,
                isLoading: _loading,
                onPressed: pending.hasInvitation ? _submit : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
