import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/calendar/services/calendar_sync_service.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';

/// Page d'aide : import manuel + ajout natif / export .ics du planning.
class CalendarSyncScreen extends ConsumerStatefulWidget {
  const CalendarSyncScreen({
    super.key,
    required this.clubId,
    this.eventId,
  });

  final String clubId;
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
        ViroSnackBar.show(context, 'Action calendrier impossible');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubAsync = ref.watch(clubProvider(widget.clubId));
    final eventsAsync = ref.watch(clubEventsProvider(widget.clubId));
    final theme = Theme.of(context).textTheme;

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: const Text('Calendrier'),
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
          Text(
            'Ajoutez le planning ViroTeam à l’agenda de votre téléphone.',
            style: theme.bodyLarge?.copyWith(color: ViroColors.gray600),
          ),
          const SizedBox(height: ViroSpacing.lg),
          Text(
            'Ajout rapide',
            style: theme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: ViroSpacing.sm),
          eventsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, _) => const ViroErrorState(),
            data: (state) {
              final events = <ClubEvent>[
                ...state.pending,
                ...state.upcoming,
              ].where((e) => !e.canceled).toList();
              ClubEvent? focus;
              final eventId = widget.eventId;
              if (eventId != null) {
                for (final e in events) {
                  if (e.id == eventId) focus = e;
                }
              }
              focus ??= events.isNotEmpty ? events.first : null;
              final clubName = clubAsync.value?.name ?? 'ViroTeam';

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (focus != null)
                    ViroPrimaryButton(
                      label: _busy
                          ? 'Ouverture…'
                          : 'Ajouter « ${focus.title} » à mon agenda',
                      isLoading: _busy,
                      onPressed: _busy
                          ? null
                          : () => _run(() async {
                                final ok = await CalendarSyncService
                                    .addEventToDeviceCalendar(focus!);
                                if (context.mounted) {
                                  ViroSnackBar.show(
                                    context,
                                    ok
                                        ? 'Événement envoyé à l’agenda'
                                        : 'Ajout annulé ou refusé',
                                  );
                                }
                              }),
                    )
                  else
                    Text(
                      'Aucun événement à venir pour ce club.',
                      style: theme.bodyMedium
                          ?.copyWith(color: ViroColors.gray600),
                    ),
                  const SizedBox(height: ViroSpacing.sm),
                  ViroPrimaryButton(
                    label: 'Exporter le planning (.ics)',
                    outlined: true,
                    onPressed: _busy || events.isEmpty
                        ? null
                        : () => _run(() async {
                              await CalendarSyncService.shareIcsFile(
                                events: events,
                                calendarName: clubName,
                              );
                            }),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: ViroSpacing.xl),
          Text(
            'Import manuel',
            style: theme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: ViroSpacing.sm),
          const _ManualStepsCard(
            title: 'iPhone / iPad',
            steps: [
              'Appuyez sur « Exporter le planning (.ics) » ci-dessus.',
              'Choisissez « Enregistrer dans Fichiers » ou partagez vers Mail.',
              'Ouvrez le fichier .ics → « Ajouter » / « Ajouter les événements ».',
              'Sélectionnez le calendrier (iCloud ou local) puis confirmez.',
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          const _ManualStepsCard(
            title: 'Android',
            steps: [
              'Exportez le fichier .ics via le bouton ci-dessus.',
              'Ouvrez le fichier avec Google Agenda (ou l’app Calendrier).',
              'Confirmez l’import des événements dans le calendrier souhaité.',
              'Astuce : depuis Gmail / Drive, ouvrez le .ics pour l’importer.',
            ],
          ),
          const SizedBox(height: ViroSpacing.xl),
        ],
      ),
      ),
    );
  }
}

class _ManualStepsCard extends StatelessWidget {
  const _ManualStepsCard({required this.title, required this.steps});

  final String title;
  final List<String> steps;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    return ViroCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: ViroColors.primary800,
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
                    color: ViroColors.primary600,
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
