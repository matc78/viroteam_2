import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/join/providers/pending_invitation_provider.dart';
import 'package:viro_team_v2/features/join/providers/pending_invitations_provider.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/providers/session_provider.dart';
import 'package:viro_team_v2/services/invitation_service.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/widgets/common/email_verification_dialog.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

class InvitationPreviewScreen extends ConsumerStatefulWidget {
  const InvitationPreviewScreen({super.key});

  @override
  ConsumerState<InvitationPreviewScreen> createState() =>
      _InvitationPreviewScreenState();
}

class _InvitationPreviewScreenState
    extends ConsumerState<InvitationPreviewScreen> {
  bool _loading = false;
  String? _error;

  String _roleLabel(String role) => switch (role) {
        MemberRoles.coach => AppCopy.common.roleCoach,
        MemberRoles.player => AppCopy.common.rolePlayer,
        _ => role,
      };

  ViroRole _badge(String role) => switch (role) {
        MemberRoles.coach => ViroRole.coach,
        _ => ViroRole.player,
      };

  /// Ouvre le club déjà rejoint (pending invite + membership locale).
  void _openClub() {
    final pending = ref.read(pendingInvitationProvider);
    final clubId = pending.club?.id;
    if (clubId == null) return;
    final membership =
        ref.read(viroUserProvider).value?.membershipInClub(clubId);
    ref.read(sessionProvider.notifier).setActiveClub(
          clubId,
          role: membership?.role,
        );
    ref.read(pendingInvitationProvider.notifier).clear();
    context.go(AppRoutes.home);
  }

  Future<void> _accept() async {
    final pending = ref.read(pendingInvitationProvider);
    final user = ref.read(viroUserProvider).value;
    if (!pending.hasInvitation || user == null) {
      context.push('${AppRoutes.signup}?intent=join');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final invitation = pending.invitation!;
      if (invitation.isGuardian) {
        await ref.read(guardianServiceProvider).linkGuardian(
              clubId: invitation.clubId,
              invitationId: invitation.id,
            );
        ref.read(sessionProvider.notifier).setActiveClub(pending.club!.id);
      } else {
        await ref.read(invitationServiceProvider).acceptInvitation(
              invitation: invitation,
              user: user,
            );
        ref.read(sessionProvider.notifier).setActiveClub(
              pending.club!.id,
              role: invitation.isTeamInvite
                  ? MemberRoles.player
                  : invitation.role,
            );
      }
      ref.invalidate(userClubsProvider);
      ref.invalidate(userClubsWithEventsProvider);
      ref.invalidate(pendingInvitationsProvider);
      ref.invalidate(viroUserFutureProvider);
      ref.read(pendingInvitationProvider.notifier).clear();
      if (mounted) context.go(AppRoutes.home);
    } on InvitationAcceptException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (error) {
      if (!mounted) return;
      if (isEmailNotVerifiedError(error)) {
        setState(() => _loading = false);
        final verified = await showEmailVerificationDialog(
          context: context,
          email: user.email,
        );
        if (verified && mounted) await _accept();
        return;
      }
      setState(
        () => _error = callableErrorMessage(
          error,
          fallback: AppCopy.join.inviteAcceptFailed,
        ),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _decline() async {
    final pending = ref.read(pendingInvitationProvider);
    final invitation = pending.invitation;
    // Codes d’équipe multi-usage : pas de decline serveur (reste utilisable).
    if (invitation != null && !invitation.isTeamInvite) {
      await ref.read(invitationServiceProvider).declineInvitation(invitation);
    }
    ref.read(pendingInvitationProvider.notifier).clear();
    if (mounted) context.go(AppRoutes.entry);
  }

  /// Déconnecte pour permettre de se connecter avec le compte invité.
  ///
  /// L’invitation pending est conservée pour reprendre après reconnexion.
  Future<void> _useAnotherAccount() async {
    ref.read(signUpIntentProvider.notifier).setIntent(SignUpIntent.join);
    await ref.read(authServiceProvider).signOut();
    if (mounted) context.go(AppRoutes.login);
  }

  /// Ouvre le login en gardant l’intention « rejoindre » (évite club-setup).
  void _goToLoginForJoin() {
    ref.read(signUpIntentProvider.notifier).setIntent(SignUpIntent.join);
    context.push(AppRoutes.login);
  }

  @override
  Widget build(BuildContext context) {
    final pending = ref.watch(pendingInvitationProvider);
    final authUser = ref.watch(authStateProvider).value;
    final viroUser = ref.watch(viroUserProvider).value;
    final theme = Theme.of(context).textTheme;
    final isSignedIn = authUser != null;

    if (!pending.hasInvitation) {
      return ViroScaffold(
        appBar: ViroAppBar(title: Text(AppCopy.join.invitationTitle)),
        body: Center(
          child: TextButton(
            onPressed: () => context.go(AppRoutes.join),
            child: Text(AppCopy.join.enterACode),
          ),
        ),
      );
    }

    final club = pending.club!;
    final invite = pending.invitation!;
    final alreadyMember =
        viroUser != null && viroUser.isLicensedInClub(club.id);
    final childName = [
      invite.firstName?.trim() ?? '',
      invite.lastName?.trim() ?? '',
    ].where((part) => part.isNotEmpty).join(' ');
    final childFirst = (invite.firstName?.trim().isNotEmpty ?? false)
        ? invite.firstName!.trim()
        : (childName.isNotEmpty
            ? childName.split(' ').first
            : AppCopy.join.defaultChildName);

    return ViroScaffold(
      appBar: ViroAppBar(title: Text(AppCopy.join.invitationTitle)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (invite.isTeamInvite) ...[
                Text(
                  AppCopy.join.teamInviteHeadline(
                    invite.teamName?.trim().isNotEmpty == true
                        ? invite.teamName!.trim()
                        : AppCopy.common.teamFallback,
                    club.name,
                  ),
                  style: theme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: ViroSpacing.sm),
                Text(
                  club.sport,
                  textAlign: TextAlign.center,
                  style: theme.bodyMedium,
                ),
                const SizedBox(height: ViroSpacing.lg),
                Text(
                  AppCopy.join.teamInviteBody,
                  style: theme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
              ] else ...[
                Text(
                  invite.isGuardian
                      ? AppCopy.join.guardianInviteHeadline
                      : AppCopy.join.invitedToJoin,
                  style: theme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: ViroSpacing.md),
                Text(
                  club.name,
                  style: theme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                  textAlign: TextAlign.center,
                ),
                Text(
                  club.sport,
                  textAlign: TextAlign.center,
                  style: theme.bodyMedium,
                ),
                const SizedBox(height: ViroSpacing.lg),
                if (invite.isGuardian) ...[
                  Text(
                    AppCopy.join.guardianInviteBody(childFirst),
                    style: theme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                ] else ...[
                  Center(child: ViroRoleBadge(role: _badge(invite.role))),
                  const SizedBox(height: ViroSpacing.sm),
                  Text(
                    AppCopy.join.proposedRole(_roleLabel(invite.role)),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: ViroSpacing.sm),
                  Text(
                    AppCopy.join.memberAlsoPlayerAccess,
                    style: theme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                  if (invite.emailHint?.trim().isNotEmpty ?? false) ...[
                    const SizedBox(height: ViroSpacing.sm),
                    Text(
                      AppCopy.join.reservedForAccount(invite.emailHint!.trim()),
                      style: theme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ],
              if (_error != null) ...[
                const SizedBox(height: ViroSpacing.md),
                Text(
                  _error!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ],
              const Spacer(),
              if (!isSignedIn) ...[
                ViroPrimaryButton(
                  label: AppCopy.auth.createMyAccount,
                  onPressed: () =>
                      context.push('${AppRoutes.signup}?intent=join'),
                ),
                const SizedBox(height: ViroSpacing.sm),
                TextButton(
                  onPressed: _goToLoginForJoin,
                  child: Text(AppCopy.auth.alreadyHaveAccount),
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroPrimaryButton(
                  label: invite.isTeamInvite
                      ? AppCopy.common.cancel
                      : AppCopy.join.declineInvitation,
                  outlined: true,
                  onPressed: _decline,
                ),
              ] else if (alreadyMember) ...[
                ViroPrimaryButton(
                  label: AppCopy.join.openClub,
                  onPressed: _openClub,
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroPrimaryButton(
                  label: AppCopy.common.cancel,
                  outlined: true,
                  onPressed: () {
                    ref.read(pendingInvitationProvider.notifier).clear();
                    if (context.mounted) context.go(AppRoutes.home);
                  },
                ),
              ] else ...[
                ViroPrimaryButton(
                  label: invite.isTeamInvite
                      ? AppCopy.join.acceptTeamInvitation
                      : AppCopy.join.acceptInvitation,
                  isLoading: _loading,
                  onPressed: _accept,
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroPrimaryButton(
                  label: invite.isTeamInvite
                      ? AppCopy.common.cancel
                      : AppCopy.join.declineInvitation,
                  outlined: true,
                  onPressed: _loading ? null : _decline,
                ),
                TextButton(
                  onPressed: _loading ? null : _useAnotherAccount,
                  child: Text(AppCopy.auth.useAnotherAccount),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
