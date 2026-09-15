import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

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
  List<_TargetOption> _targets = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    final clubs = ref.read(userClubsProvider).value ?? const [];
    if (clubs.isEmpty) return;
    final clubId = clubs.first.club.id;
    setState(() => _clubId = clubId);
    await _loadTargets(clubId);
  }

  /// Miroir de `createCoachDm` : coaches des équipes du caller + admins club.
  Future<void> _loadTargets(String clubId) async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;

    final clubs = ref.read(userClubsProvider).value ?? const [];
    final clubEntry = clubs.where((e) => e.club.id == clubId).firstOrNull;
    final adminIds = <String>{
      ...?clubEntry?.club.adminIds,
    };

    final members =
        await ref.read(memberServiceProvider).watchClubMembers(clubId).first;
    final myTeams = await ref.read(myTeamsProvider(clubId).future);

    final rosterToAccountUid = <String, String>{};
    for (final member in members) {
      final accountUid = member.accountUid?.trim();
      if (accountUid == null || accountUid.isEmpty) continue;
      rosterToAccountUid[member.memberId] = accountUid;
      rosterToAccountUid[accountUid] = accountUid;
      if (member.role == MemberRoles.admin) {
        adminIds.add(accountUid);
      }
    }

    final allowedUids = <String>{...adminIds};
    for (final team in myTeams) {
      for (final coachRosterId in team.coachIds) {
        final accountUid = rosterToAccountUid[coachRosterId];
        if (accountUid != null && accountUid.isNotEmpty) {
          allowedUids.add(accountUid);
        } else if (coachRosterId.isNotEmpty) {
          // Roster déjà stocké en Auth uid.
          allowedUids.add(coachRosterId);
        }
      }
    }
    allowedUids.remove(uid);

    final options = <_TargetOption>[];
    final seen = <String>{};
    for (final member in members) {
      final role = member.role;
      if (role != MemberRoles.admin && role != MemberRoles.coach) continue;
      final accountUid = member.accountUid?.trim();
      if (accountUid == null ||
          accountUid.isEmpty ||
          accountUid == uid ||
          !allowedUids.contains(accountUid) ||
          !seen.add(accountUid)) {
        continue;
      }
      options.add(
        _TargetOption(
          uid: accountUid,
          label: member.fullName.trim().isEmpty
              ? accountUid
              : member.fullName.trim(),
          role: role,
        ),
      );
    }
    // Admins présents dans `adminIds` mais pas encore en fiche membre listée.
    for (final adminUid in adminIds) {
      if (adminUid == uid || !seen.add(adminUid)) continue;
      options.add(
        _TargetOption(
          uid: adminUid,
          label: adminUid,
          role: MemberRoles.admin,
        ),
      );
    }

    if (!mounted) return;
    setState(() => _targets = options);
  }

  Future<void> _start() async {
    final clubId = _clubId;
    if (clubId == null || _selected.isEmpty) return;
    setState(() => _busy = true);
    try {
      final conversationId =
          await ref.read(chatServiceProvider).createCoachDm(
                clubId: clubId,
                targetUids: _selected.toList(),
              );
      if (!mounted) return;
      Navigator.of(context).pop();
      context.push(AppRoutes.conversationPath(clubId, conversationId));
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.chat.sendFailed);
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
            const SizedBox(height: ViroSpacing.sm),
            if (_targets.isEmpty)
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
                    return ViroCard(
                      margin: const EdgeInsets.only(bottom: ViroSpacing.xs),
                      child: CheckboxListTile(
                        value: selected,
                        title: Text(target.label),
                        subtitle: Text(target.role),
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
            FilledButton(
              onPressed: _busy || _selected.isEmpty ? null : _start,
              child: Text(AppCopy.chat.startChat),
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
  });

  final String uid;
  final String label;
  final String role;
}
