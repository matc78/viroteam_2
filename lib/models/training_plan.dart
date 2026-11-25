import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';

/// Préparation de séance d'un coach
/// (`events/{eventId}/trainingPlans/{coachUid}`).
class TrainingPlan {
  const TrainingPlan({
    required this.coachUid,
    this.coachName = '',
    this.notes = '',
    this.drillOrder = const [],
    this.updatedAt,
  });

  /// Uid du coach (id du document).
  final String coachUid;
  final String coachName;

  /// Notes libres de la séance.
  final String notes;

  /// Ordre des exercices (ids de `drills`).
  final List<String> drillOrder;
  final DateTime? updatedAt;

  /// Lit un document `trainingPlans/{coachUid}`.
  factory TrainingPlan.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    final updatedAt = data[FirestoreFields.updatedAt];
    return TrainingPlan(
      coachUid: doc.id,
      coachName: data[FirestoreFields.coachName] as String? ?? '',
      notes: data[FirestoreFields.notes] as String? ?? '',
      drillOrder: (data[FirestoreFields.drillOrder] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          const [],
      updatedAt: updatedAt is Timestamp ? updatedAt.toDate() : null,
    );
  }

  /// Exercices [drills] rangés selon [drillOrder] (inconnus à la fin).
  List<TrainingDrill> ordered(Iterable<TrainingDrill> drills) {
    final rank = {for (var i = 0; i < drillOrder.length; i++) drillOrder[i]: i};
    final sorted = drills.toList()
      ..sort((a, b) {
        final ra = rank[a.id] ?? drillOrder.length;
        final rb = rank[b.id] ?? drillOrder.length;
        return ra != rb ? ra.compareTo(rb) : a.id.compareTo(b.id);
      });
    return sorted;
  }
}

/// Exercice d'une préparation (`trainingPlans/{coachUid}/drills/{drillId}`).
class TrainingDrill {
  const TrainingDrill({
    required this.id,
    this.title = '',
    this.durationMin,
    this.instructions = '',
    this.board = WhiteboardData.empty,
  });

  final String id;
  final String title;

  /// Durée prévue en minutes, facultative.
  final int? durationMin;

  /// Consignes de l'exercice.
  final String instructions;

  /// Schéma sur terrain de volley (vectoriel).
  final WhiteboardData board;

  /// Lit un document `drills/{drillId}`.
  factory TrainingDrill.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    final duration = data[FirestoreFields.durationMin];
    return TrainingDrill(
      id: doc.id,
      title: data[FirestoreFields.title] as String? ?? '',
      durationMin: duration is num && duration > 0 ? duration.toInt() : null,
      instructions: data[FirestoreFields.instructions] as String? ?? '',
      board: WhiteboardData.fromMap(data[FirestoreFields.board]),
    );
  }

  /// Copie avec les champs fournis ([clearDuration] retire la durée).
  TrainingDrill copyWith({
    String? title,
    int? durationMin,
    bool clearDuration = false,
    String? instructions,
    WhiteboardData? board,
  }) =>
      TrainingDrill(
        id: id,
        title: title ?? this.title,
        durationMin: clearDuration ? null : (durationMin ?? this.durationMin),
        instructions: instructions ?? this.instructions,
        board: board ?? this.board,
      );

  /// Données Firestore de l'exercice.
  Map<String, dynamic> toFirestore() => {
        FirestoreFields.title: title.trim(),
        FirestoreFields.durationMin: durationMin,
        FirestoreFields.instructions: instructions,
        FirestoreFields.board: board.toMap(),
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      };
}

/// Total des durées prévues de [drills] (minutes, exercices sans durée ignorés).
int plannedMinutes(Iterable<TrainingDrill> drills) =>
    drills.fold(0, (total, drill) => total + (drill.durationMin ?? 0));

/// Durée de séance en minutes depuis les heures `HH:mm` de l'événement,
/// `null` si l'une manque ou si la fin n'est pas après le début.
int? sessionMinutes(String? startTime, String? endTime) {
  int? minutesOf(String? time) {
    final match = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(time?.trim() ?? '');
    if (match == null) return null;
    return int.parse(match.group(1)!) * 60 + int.parse(match.group(2)!);
  }

  final start = minutesOf(startTime);
  final end = minutesOf(endTime);
  if (start == null || end == null || end <= start) return null;
  return end - start;
}
