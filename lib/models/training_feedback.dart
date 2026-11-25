import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Bornes des notes collectives d'une séance (niveau de jeu, envie).
///
/// Demi-étoiles : pas de `0.5`, de [min] à [max] (ex. 1, 1.5, …, 5).
abstract final class TrainingRatings {
  static const double min = 1;
  static const double max = 5;
  static const double step = 0.5;

  /// Longueur max d'un message (aligné sur la callable `sendTrainingFeedback`).
  static const int messageMaxChars = 500;

  /// `true` si [value] est une note valide (1–5 par pas de 0.5).
  static bool isValid(double value) {
    if (value < min || value > max) return false;
    final halves = (value / step).round();
    return (halves * step - value).abs() < 1e-9;
  }

  /// Affiche `4` ou `3.5` selon la note.
  static String format(double value) => value == value.roundToDouble()
      ? '${value.round()}'
      : value.toStringAsFixed(1);
}

DateTime? _date(Object? raw) => raw is Timestamp ? raw.toDate() : null;

double? _rating(Object? raw) {
  final value = raw is num ? raw.toDouble() : null;
  if (value == null) return null;
  return TrainingRatings.isValid(value) ? value : null;
}

String? _text(Object? raw) {
  final value = raw is String ? raw.trim() : '';
  return value.isEmpty ? null : value;
}

/// Retour de séance envoyé par un coach
/// (`events/{eventId}/trainingFeedback/{coachUid}`), visible de l'équipe.
class TrainingFeedback {
  const TrainingFeedback({
    required this.coachUid,
    required this.coachName,
    required num levelRating,
    required num engagementRating,
    this.collectiveMessage,
    this.playerMessageCount = 0,
    this.sentAt,
  })  : _levelRating = levelRating,
        _engagementRating = engagementRating;

  /// Uid du coach (id du document).
  final String coachUid;
  final String coachName;

  /// Stockage [num] : Firestore renvoie un `int` pour les notes entières.
  final num _levelRating;
  final num _engagementRating;

  /// Niveau de jeu proposé par l'équipe (1–5, demi-étoiles).
  double get levelRating =>
      _rating(_levelRating) ?? TrainingRatings.min;

  /// Envie / participation de l'équipe (1–5, demi-étoiles).
  double get engagementRating =>
      _rating(_engagementRating) ?? TrainingRatings.min;

  /// Mot au collectif, facultatif.
  final String? collectiveMessage;

  /// Nombre de messages perso envoyés avec ce retour.
  final int playerMessageCount;
  final DateTime? sentAt;

  /// Lit un document `trainingFeedback/{coachUid}` (notes invalides → 1).
  factory TrainingFeedback.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    return TrainingFeedback(
      coachUid: doc.id,
      coachName: data[FirestoreFields.coachName] as String? ?? '',
      levelRating: data[FirestoreFields.levelRating] as num? ?? TrainingRatings.min,
      engagementRating:
          data[FirestoreFields.engagementRating] as num? ?? TrainingRatings.min,
      collectiveMessage: _text(data[FirestoreFields.collectiveMessage]),
      playerMessageCount:
          (data[FirestoreFields.playerMessageCount] as num?)?.toInt() ?? 0,
      sentAt: _date(data[FirestoreFields.sentAt]),
    );
  }
}

/// Message perso d'un coach à un joueur
/// (`trainingFeedback/{coachUid}/playerMessages/{memberId}`).
class TrainingPlayerMessage {
  const TrainingPlayerMessage({
    required this.coachUid,
    required this.coachName,
    required this.memberId,
    required this.message,
    this.sentAt,
  });

  final String coachUid;
  final String coachName;

  /// Id de la fiche du joueur (id du document).
  final String memberId;
  final String message;
  final DateTime? sentAt;

  /// Lit un document `playerMessages/{memberId}`.
  factory TrainingPlayerMessage.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    return TrainingPlayerMessage(
      coachUid: data[FirestoreFields.coachUid] as String? ?? '',
      coachName: data[FirestoreFields.coachName] as String? ?? '',
      memberId: doc.id,
      message: _text(data[FirestoreFields.message]) ?? '',
      sentAt: _date(data[FirestoreFields.sentAt]),
    );
  }
}

/// Brouillon d'un retour, privé au coach
/// (`events/{eventId}/trainingFeedbackDrafts/{coachUid}`).
class TrainingFeedbackDraft {
  const TrainingFeedbackDraft({
    num? levelRating,
    num? engagementRating,
    this.collectiveMessage = '',
    this.playerMessages = const {},
  })  : _levelRating = levelRating,
        _engagementRating = engagementRating;

  /// Brouillon vide (premier passage du coach).
  static const empty = TrainingFeedbackDraft();

  /// Stockage [num] : Firestore renvoie un `int` pour les notes entières.
  final num? _levelRating;
  final num? _engagementRating;
  final String collectiveMessage;

  /// Fiche membre → message perso en cours d'écriture.
  final Map<String, String> playerMessages;

  /// Niveau de jeu (1–5, demi-étoiles), `null` si pas encore posé.
  double? get levelRating => _rating(_levelRating);

  /// Envie / participation (1–5, demi-étoiles), `null` si pas encore posé.
  double? get engagementRating => _rating(_engagementRating);

  /// Les deux notes collectives sont posées : le retour peut partir.
  bool get canSend => levelRating != null && engagementRating != null;

  /// Messages perso non vides, limités aux joueurs [memberIds] de la séance.
  Map<String, String> messagesFor(Iterable<String> memberIds) => {
        for (final id in memberIds)
          if ((playerMessages[id] ?? '').trim().isNotEmpty)
            id: playerMessages[id]!.trim(),
      };

  /// Copie avec les champs fournis.
  TrainingFeedbackDraft copyWith({
    num? levelRating,
    num? engagementRating,
    String? collectiveMessage,
    Map<String, String>? playerMessages,
  }) =>
      TrainingFeedbackDraft(
        levelRating: levelRating ?? _levelRating,
        engagementRating: engagementRating ?? _engagementRating,
        collectiveMessage: collectiveMessage ?? this.collectiveMessage,
        playerMessages: playerMessages ?? this.playerMessages,
      );

  /// Copie avec le message perso de [memberId] remplacé.
  TrainingFeedbackDraft withPlayerMessage(String memberId, String message) =>
      copyWith(playerMessages: {...playerMessages, memberId: message});

  /// Brouillon pré-rempli depuis un retour déjà envoyé (correction).
  factory TrainingFeedbackDraft.fromSent({
    required TrainingFeedback feedback,
    required Iterable<TrainingPlayerMessage> messages,
  }) =>
      TrainingFeedbackDraft(
        levelRating: feedback.levelRating,
        engagementRating: feedback.engagementRating,
        collectiveMessage: feedback.collectiveMessage ?? '',
        playerMessages: {for (final m in messages) m.memberId: m.message},
      );

  /// Lit un brouillon (`null` si absent).
  static TrainingFeedbackDraft? fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data();
    if (data == null) return null;
    final rawMessages = data[FirestoreFields.playerMessages];
    return TrainingFeedbackDraft(
      levelRating: data[FirestoreFields.levelRating] as num?,
      engagementRating: data[FirestoreFields.engagementRating] as num?,
      collectiveMessage: data[FirestoreFields.collectiveMessage] as String? ?? '',
      playerMessages: rawMessages is Map
          ? {
              for (final entry in rawMessages.entries)
                if (entry.key is String && entry.value is String)
                  entry.key as String: entry.value as String,
            }
          : const {},
    );
  }

  /// Données Firestore du brouillon.
  Map<String, dynamic> toFirestore() => {
        FirestoreFields.levelRating: levelRating,
        FirestoreFields.engagementRating: engagementRating,
        FirestoreFields.collectiveMessage: collectiveMessage,
        FirestoreFields.playerMessages: playerMessages,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      };
}

/// Statut de mon retour sur un entraînement (côté coach).
enum TrainingFeedbackStatus {
  /// Retour pas encore fait.
  todo,

  /// Retour envoyé.
  sent,

  /// Coach qui a assumé ne pas faire de retour (« flemme »).
  skipped,
}

/// État perso d'un compte sur un entraînement
/// (`users/{uid}/trainingFeedbackState/{clubId}_{eventId}`), écrit par le
/// client : « flemme » côté coach, retours déjà lus côté joueur / parent.
class TrainingFeedbackUserState {
  const TrainingFeedbackUserState({
    required this.eventId,
    this.skipped = false,
    this.seen = const {},
  });

  final String eventId;

  /// Le coach a renoncé au retour : la séance sort de ses rappels.
  final bool skipped;

  /// Fiche lue (soi ou enfant) → coachs dont le retour a été lu.
  final Map<String, List<String>> seen;

  /// Id du document d'état pour [eventId] de [clubId].
  static String docId(String clubId, String eventId) => '${clubId}_$eventId';

  /// `true` si le retour de [coachUid] a déjà été lu pour [memberId].
  bool hasSeen(String memberId, String coachUid) =>
      seen[memberId]?.contains(coachUid) ?? false;

  /// Lit un document d'état (champs absents → valeurs par défaut).
  factory TrainingFeedbackUserState.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    final rawSeen = data[FirestoreFields.seen];
    return TrainingFeedbackUserState(
      eventId: data[FirestoreFields.eventId] as String? ?? '',
      skipped: data[FirestoreFields.skipped] == true,
      seen: rawSeen is Map
          ? {
              for (final entry in rawSeen.entries)
                if (entry.key is String && entry.value is List)
                  entry.key as String:
                      (entry.value as List).whereType<String>().toList(),
            }
          : const {},
    );
  }
}
