import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/utils/search_key.dart';

/// Fenêtre de la bibliothèque : séances passées des 6 derniers mois (jours),
/// comme la page Séances du portail.
const int trainingLibraryPastDays = 183;

/// Nombre max de séances passées lues pour la bibliothèque (les plus récentes).
const int trainingLibraryMaxEvents = 40;

/// Préparation d'un coach sur une séance passée (moi ou un collègue).
class TrainingLibrarySession {
  const TrainingLibrarySession({
    required this.event,
    required this.coachUid,
    required this.coachName,
    required this.notes,
    required this.drills,
  });

  final ClubEvent event;
  final String coachUid;
  final String coachName;
  final String notes;

  /// Exercices dans l'ordre de la préparation.
  final List<TrainingDrill> drills;

  /// Clé stable de la ligne (séance + coach).
  String get key => '${event.id}:$coachUid';
}

/// Exercice proposé par la bibliothèque, avec sa séance d'origine.
class TrainingLibraryDrillRow {
  const TrainingLibraryDrillRow({
    required this.key,
    required this.drill,
    required this.session,
  });

  /// Clé stable de la ligne (séance + coach + exercice).
  final String key;
  final TrainingDrill drill;
  final TrainingLibrarySession session;
}

/// Séances dont le titre, les notes, le coach ou un titre d'exercice
/// contiennent [query] (sans accents ni casse) ; toutes si [query] est vide.
List<TrainingLibrarySession> filterLibrarySessions(
  List<TrainingLibrarySession> sessions,
  String query, {
  String Function(ClubEvent event)? eventTitle,
}) {
  final needle = searchKey(query);
  if (needle.isEmpty) return sessions;
  return [
    for (final session in sessions)
      if (searchKey(
        [
          eventTitle?.call(session.event) ?? session.event.title,
          session.notes,
          session.coachName,
          for (final drill in session.drills) drill.title,
        ].join(' '),
      ).contains(needle))
        session,
  ];
}

/// Exercices de [sessions] sans doublon (même titre et mêmes consignes
/// réutilisés d'une séance à l'autre : une seule ligne ; un exercice à
/// schéma seul reste unique), filtrés sur [query] (titre + consignes).
/// Les exercices sans texte ni schéma sont ignorés.
List<TrainingLibraryDrillRow> libraryDrillRows(
  List<TrainingLibrarySession> sessions,
  String query,
) {
  final needle = searchKey(query);
  final seen = <String>{};
  final rows = <TrainingLibraryDrillRow>[];
  for (final session in sessions) {
    for (final drill in session.drills) {
      final hasText =
          drill.title.trim().isNotEmpty || drill.instructions.trim().isNotEmpty;
      if (!hasText && drill.boards.isEmpty) continue;
      final signature = hasText
          ? searchKey('${drill.title}|${drill.instructions}')
          : 'board:${session.event.id}:${drill.id}';
      if (!seen.add(signature)) continue;
      if (needle.isNotEmpty &&
          !searchKey('${drill.title} ${drill.instructions}').contains(needle)) {
        continue;
      }
      rows.add(
        TrainingLibraryDrillRow(
          key: '${session.key}:${drill.id}',
          drill: drill,
          session: session,
        ),
      );
    }
  }
  return rows;
}
