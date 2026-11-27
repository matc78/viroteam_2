import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';
import 'package:viro_team_v2/services/training/training_library.dart';

ClubEvent _event(String id) => ClubEvent(
  id: id,
  clubId: 'c',
  type: EventTypes.training,
  title: 'Entraînement',
  date: DateTime(2026, 11, 20),
);

TrainingLibrarySession _session(
  String eventId,
  List<TrainingDrill> drills, {
  String coachName = 'Léa',
  String notes = '',
}) => TrainingLibrarySession(
  event: _event(eventId),
  coachUid: 'coach',
  coachName: coachName,
  notes: notes,
  drills: drills,
);

void main() {
  final sessions = [
    _session('e1', const [
      TrainingDrill(id: 'd1', title: 'Réception', instructions: 'Par 3'),
      TrainingDrill(id: 'd2'),
    ], notes: 'Travail du service'),
    _session('e2', const [
      // Même exercice réutilisé : une seule ligne.
      TrainingDrill(id: 'd3', title: 'reception', instructions: 'par 3'),
      TrainingDrill(id: 'd4', boards: [WhiteboardData()]),
      TrainingDrill(id: 'd5', boards: [WhiteboardData()]),
    ], coachName: 'Hugo'),
  ];

  test('filtre les séances sans accents (titres, notes, coach)', () {
    expect(filterLibrarySessions(sessions, ''), hasLength(2));
    expect(
      [for (final s in filterLibrarySessions(sessions, 'RECEPTION')) s.key],
      ['e1:coach', 'e2:coach'],
    );
    expect(
      [for (final s in filterLibrarySessions(sessions, 'service')) s.key],
      ['e1:coach'],
    );
    expect(
      [for (final s in filterLibrarySessions(sessions, 'hugo')) s.key],
      ['e2:coach'],
    );
  });

  test('exercices sans doublon, sans les vides, schéma seul unique', () {
    final rows = libraryDrillRows(sessions, '');
    expect([for (final row in rows) row.drill.id], ['d1', 'd4', 'd5']);
    expect(rows.first.key, 'e1:coach:d1');
    expect(
      [for (final row in libraryDrillRows(sessions, 'réc')) row.drill.id],
      ['d1'],
    );
  });

  test('copyAsNew garde le contenu sous un nouvel id', () {
    const drill = TrainingDrill(
      id: 'd1',
      title: 'Bloc',
      durationMin: 10,
      instructions: 'Deux contre un',
      boards: [WhiteboardData()],
    );
    final copy = drill.copyAsNew('n1');
    expect(copy.id, 'n1');
    expect(copy.title, 'Bloc');
    expect(copy.durationMin, 10);
    expect(copy.instructions, 'Deux contre un');
    expect(copy.boards, hasLength(1));
  });
}
