import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Timeout max pour les lectures sheet (évite loader infini).
const _kLoadTimeout = Duration(seconds: 6);

/// Sheet : démarrer une discussion avec coaches / admins.
Future<void> showNewConversationSheet(
  BuildContext context,
  WidgetRef ref,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: ViroColors.scaffold,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) => const _NewConversationSheet(),
  );
}

class _NewConversationSheet extends ConsumerStatefulWidget {
  const _NewConversationSheet();

  @override
  ConsumerState<_NewConversationSheet> createState() =>
      _NewConversationSheetState();
}

class _NewConversationSheetState extends ConsumerState<_NewConversationSheet> {
  String? _clubId;
  final Set<String> _selected = {};
  bool _busy = false;
  bool _loadingTargets = true;
  List<_TargetOption> _targets = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    final clubs = ref.read(userClubsProvider).value ?? const [];
    if (clubs.isEmpty) {
      if (mounted) setState(() => _loadingTargets = false);
      return;
    }
    final clubId = clubs.first.club.id;
    setState(() => _clubId = clubId);
    await _loadTargets(clubId);
  }

  /// Charge les équipes du caller sans bloquer sur un `.future` de StreamProvider.
  Future<List<ClubTeam>> _loadCallerTeams(String clubId, String uid) async {
    final teamService = ref.read(teamServiceProvider);
    try {
      if (ref.read(isGuardianOnlyInClubProvider(clubId))) {
        final teamIds = await ref
            .read(guardianChildTeamIdsProvider(clubId).future)
            .timeout(_kLoadTimeout);
        return teamService
            .watchTeamsByIds(clubId: clubId, teamIds: teamIds)
            .first
            .timeout(_kLoadTimeout);
      }

      // Warm fiche membre (best-effort) pour résoudre memberId → équipes.
      try {
        await ref
            .read(clubMemberProvider(clubId).future)
            .timeout(const Duration(seconds: 3));
      } catch (_) {}

      final member = ref.read(clubMemberProvider(clubId)).value;
      return teamService
          .watchUserTeams(
            clubId: clubId,
            uid: member?.memberId ?? uid,
            alternateUid: uid,
          )
          .first
          .timeout(_kLoadTimeout);
    } catch (_) {
      return const [];
    }
  }

  /// Résout une fiche membre (memberId ou Auth uid) via get — pas de list.
  Future<ClubMember?> _fetchMemberByRosterOrAuthId(
    String clubId,
    String rosterOrAuthId,
  ) async {
    final id = rosterOrAuthId.trim();
    if (id.isEmpty) return null;
    final guardian = ref.read(guardianServiceProvider);
    final events = ref.read(eventServiceProvider);

    try {
      final direct = await guardian
          .getClubMember(clubId: clubId, memberId: id)
          .timeout(const Duration(seconds: 3));
      if (direct != null) return direct;
    } catch (_) {}

    // adminIds / parfois coachIds stockés en Auth uid → index member_accounts.
    try {
      final memberId = await events
          .resolveAudienceId(clubId: clubId, authUid: id)
          .timeout(const Duration(seconds: 3));
      if (memberId.isNotEmpty && memberId != id) {
        return await guardian
            .getClubMember(clubId: clubId, memberId: memberId)
            .timeout(const Duration(seconds: 3));
      }
    } catch (_) {}

    return null;
  }

  /// Miroir de `createCoachDm` : coaches des équipes du caller + admins club.
  Future<void> _loadTargets(String clubId) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) {
      if (mounted) {
        setState(() {
          _targets = const [];
          _loadingTargets = false;
        });
      }
      return;
    }

    if (mounted) setState(() => _loadingTargets = true);

    var options = <_TargetOption>[];
    try {
      final clubs = ref.read(userClubsProvider).value ?? const [];
      final clubEntry = clubs.where((e) => e.club.id == clubId).firstOrNull;
      final rosterIds = <String>{
        ...?clubEntry?.club.adminIds,
      };

      final isGuardianOnly = ref.read(isGuardianOnlyInClubProvider(clubId));

      // Parent : `list` members = PERMISSION_DENIED → get individuels seulement.
      List<ClubMember> members = const [];
      if (!isGuardianOnly) {
        try {
          members = await ref
              .read(memberServiceProvider)
              .watchClubMembers(clubId)
              .first
              .timeout(_kLoadTimeout);
        } catch (_) {
          members = const [];
        }
      }

      final myTeams = await _loadCallerTeams(clubId, uid);
      for (final team in myTeams) {
        rosterIds.addAll(team.coachIds.where((id) => id.trim().isNotEmpty));
      }

      final memberByKey = <String, ClubMember>{};
      void indexMember(ClubMember member) {
        memberByKey[member.memberId] = member;
        final accountUid = member.accountUid?.trim();
        if (accountUid != null && accountUid.isNotEmpty) {
          memberByKey[accountUid] = member;
        }
      }

      for (final member in members) {
        indexMember(member);
        if (member.role == MemberRoles.admin) {
          final accountUid = member.accountUid?.trim();
          if (accountUid != null && accountUid.isNotEmpty) {
            rosterIds.add(accountUid);
          }
          rosterIds.add(member.memberId);
        }
      }

      final missingIds =
          rosterIds.where((id) => !memberByKey.containsKey(id)).toList();
      await Future.wait(
        missingIds.map((id) async {
          final fetched = await _fetchMemberByRosterOrAuthId(clubId, id);
          if (fetched != null) indexMember(fetched);
        }),
      );

      final seenAuthUids = <String>{};
      for (final rosterOrAuthId in rosterIds) {
        final member = memberByKey[rosterOrAuthId];
        final accountUid = member?.accountUid?.trim();
        if (accountUid == null ||
            accountUid.isEmpty ||
            accountUid == uid ||
            !seenAuthUids.add(accountUid)) {
          continue;
        }

        final label = member!.fullName.trim().isNotEmpty
            ? member.fullName.trim()
            : AppCopy.members.unnamed;

        options.add(
          _TargetOption(
            uid: accountUid,
            label: label,
            role: member.role,
            member: member,
          ),
        );
      }
      options.sort(
        (a, b) => a.label.toLowerCase().compareTo(b.label.toLowerCase()),
      );
    } catch (_) {
      options = [];
    } finally {
      if (mounted) {
        setState(() {
          _targets = options;
          _loadingTargets = false;
        });
      }
    }
  }

  Future<void> _start() async {
    final clubId = _clubId;
    if (clubId == null || _selected.isEmpty) return;
    setState(() => _busy = true);
    // Capturer avant pop : le context de la sheet est invalidé ensuite.
    final router = GoRouter.of(context);
    try {
      // createCoachDm est idempotent (systemKey dm:…) — ouvre la DM existante.
      final conversationId =
          await ref.read(chatServiceProvider).createCoachDm(
                clubId: clubId,
                targetUids: _selected.toList(),
              );
      if (!mounted) return;
      Navigator.of(context).pop();
      router.push(AppRoutes.conversationPath(clubId, conversationId));
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          callableErrorMessage(error, fallback: AppCopy.chat.sendFailed),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubs = ref.watch(userClubsProvider).value ?? const [];
    final theme = Theme.of(context).textTheme;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: ViroSpacing.screenHorizontal,
          right: ViroSpacing.screenHorizontal,
          top: ViroSpacing.md,
          bottom: MediaQuery.viewInsetsOf(context).bottom + ViroSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AppCopy.chat.newConversation,
              style: theme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Text(
              AppCopy.chat.newConversationHint,
              style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
            ),
            const SizedBox(height: ViroSpacing.sm),
            if (clubs.length > 1)
              DropdownButtonFormField<String>(
                initialValue: _clubId,
                items: clubs
                    .map(
                      (e) => DropdownMenuItem(
                        value: e.club.id,
                        child: Text(e.club.name),
                      ),
                    )
                    .toList(),
                onChanged: (value) async {
                  if (value == null) return;
                  setState(() {
                    _clubId = value;
                    _selected.clear();
                  });
                  await _loadTargets(value);
                },
              ),
            if (clubs.length == 1) ...[
              InputDecorator(
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                child: Text(clubs.first.club.name),
              ),
            ],
            const SizedBox(height: ViroSpacing.sm),
            if (_loadingTargets)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: ViroSpacing.lg),
                child: Center(child: ViroLogoLoader(size: 36)),
              )
            else if (_targets.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: ViroSpacing.md),
                child: Text(AppCopy.chat.noTargets),
              )
            else
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: _targets.map((target) {
                    final selected = _selected.contains(target.uid);
                    final member = target.member;
                    return ViroCard(
                      margin: const EdgeInsets.only(bottom: ViroSpacing.xs),
                      padding: const EdgeInsets.symmetric(
                        horizontal: ViroSpacing.sm,
                        vertical: ViroSpacing.xs,
                      ),
                      child: CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        value: selected,
                        secondary: member != null
                            ? MemberAvatar(member: member, size: 40)
                            : null,
                        title: Text(
                          target.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: ViroColors.primary800,
                          ),
                        ),
                        subtitle: Align(
                          alignment: Alignment.centerLeft,
                          child: Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: ViroRoleBadge(
                              role: viroRoleFromMemberRole(target.role),
                              compact: true,
                            ),
                          ),
                        ),
                        onChanged: (value) {
                          setState(() {
                            if (value == true) {
                              _selected.add(target.uid);
                            } else {
                              _selected.remove(target.uid);
                            }
                          });
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
            const SizedBox(height: ViroSpacing.sm),
            ViroPrimaryButton(
              label: AppCopy.chat.startChat,
              isLoading: _busy,
              onPressed: _busy || _selected.isEmpty || _loadingTargets
                  ? null
                  : _start,
            ),
          ],
        ),
      ),
    );
  }
}

class _TargetOption {
  const _TargetOption({
    required this.uid,
    required this.label,
    required this.role,
    this.member,
  });

  /// Auth uid passé à `createCoachDm`.
  final String uid;
  final String label;
  final String role;
  final ClubMember? member;
}
