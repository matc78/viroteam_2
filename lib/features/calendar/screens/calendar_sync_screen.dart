import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/calendar/services/calendar_sync_service.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Page d'aide : ajouter le planning club (calendrier dynamique) à l'agenda.
class CalendarSyncScreen extends ConsumerStatefulWidget {
  const CalendarSyncScreen({
    super.key,
    required this.clubId,
    this.eventId,
  });

  final String clubId;

  /// Conservé pour compat deep-link ; non utilisé pour l'UI actuelle.
  final String? eventId;

  @override
  ConsumerState<CalendarSyncScreen> createState() => _CalendarSyncScreenState();
}

class _CalendarSyncScreenState extends ConsumerState<CalendarSyncScreen> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.calendar.actionFailed);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubAsync = ref.watch(clubProvider(widget.clubId));
    final accent = ref.watch(clubMemberAccentProvider(widget.clubId));
    final eventsAsync = ref.watch(clubEventsProvider(widget.clubId));
    final theme = Theme.of(context).textTheme;

    return ClubAccentTheme(
      accentColor: accent,
      child: ViroScaffold(
        appBar: ViroAppBar(
          leading: IconButton(
            icon: ViroIcon(ViroIcons.chevronLeft),
            onPressed: () => context.pop(),
          ),
          title: Text(AppCopy.calendar.screenTitle),
        ),
        body: ViroRefreshIndicator(
          onRefresh: () async {
            await Future.wait([
              ref.refresh(clubProvider(widget.clubId).future),
              ref.refresh(memberEventsProvider.future),
            ]);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(ViroSpacing.lg),
            children: [
              ViroCard(
                accentColor: accent,
                borderColor: ClubAccentStyle(accent).border,
                child: Text(
                  AppCopy.calendar.intro,
                  style: theme.bodyLarge?.copyWith(color: ViroColors.gray600),
                ),
              ),
              const SizedBox(height: ViroSpacing.lg),
              Text(
                AppCopy.calendar.addToAgendaSection,
                style: theme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: ViroSpacing.sm),
              eventsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, __) => const ViroErrorState(),
                data: (state) {
                  final events = <ClubEvent>[
                    ...state.pending,
                    ...state.upcoming,
                  ].where((e) => !e.canceled).toList();
                  final clubName = clubAsync.value?.name ?? 'ViroTeam';

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ViroPrimaryButton(
                        label: _busy
                            ? AppCopy.common.preparing
                            : AppCopy.calendar.addDynamicCalendar,
                        isLoading: _busy,
                        onPressed: _busy || events.isEmpty
                            ? null
                            : () => _run(() async {
                                  await CalendarSyncService.shareIcsFile(
                                    events: events,
                                    calendarName: clubName,
                                  );
                                  if (context.mounted) {
                                    ViroSnackBar.show(
                                      context,
                                      AppCopy.calendar.icsReady,
                                    );
                                  }
                                }),
                      ),
                      if (events.isEmpty) ...[
                        const SizedBox(height: ViroSpacing.sm),
                        Text(
                          AppCopy.calendar.noUpcoming,
                          style: theme.bodyMedium
                              ?.copyWith(color: ViroColors.gray600),
                        ),
                      ],
                    ],
                  );
                },
              ),
              const SizedBox(height: ViroSpacing.xl),
              Text(
                AppCopy.calendar.manualImportSection,
                style: theme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: ViroSpacing.sm),
              _ManualStepsCard(
                title: AppCopy.calendar.iosTitle,
                accentColor: accent,
                steps: AppCopy.calendar.iosSteps,
              ),
              const SizedBox(height: ViroSpacing.sm),
              _ManualStepsCard(
                title: AppCopy.calendar.androidTitle,
                accentColor: accent,
                steps: AppCopy.calendar.androidSteps,
              ),
              const SizedBox(height: ViroSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}

class _ManualStepsCard extends StatelessWidget {
  const _ManualStepsCard({
    required this.title,
    required this.steps,
    this.accentColor,
  });

  final String title;
  final List<String> steps;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = accentColor ?? ViroColors.primary600;
    return ViroCard(
      accentColor: accentColor,
      borderColor: accentColor != null
          ? ClubAccentStyle(accentColor!).border
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: accent,
            ),
          ),
          const SizedBox(height: ViroSpacing.sm),
          for (var i = 0; i < steps.length; i++) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${i + 1}.',
                  style: theme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: accent,
                  ),
                ),
                const SizedBox(width: ViroSpacing.sm),
                Expanded(
                  child: Text(
                    steps[i],
                    style: theme.bodyMedium?.copyWith(height: 1.4),
                  ),
                ),
              ],
            ),
            if (i < steps.length - 1) const SizedBox(height: ViroSpacing.sm),
          ],
        ],
      ),
    );
  }
}
