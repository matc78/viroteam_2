import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Option d’un sondage chat.
class ChatPollOption {
  const ChatPollOption({
    required this.id,
    required this.text,
  });

  final String id;
  final String text;

  Map<String, dynamic> toMap() => {
        'id': id,
        'text': text,
      };

  factory ChatPollOption.fromMap(Map<String, dynamic> map) {
    return ChatPollOption(
      id: map['id'] as String? ?? '',
      text: (map['text'] as String? ?? '').trim(),
    );
  }
}

/// Message d’une conversation chat.
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.clubId,
    required this.type,
    required this.senderUid,
    required this.createdAt,
    this.text,
    this.storagePath,
    this.downloadUrl,
    this.thumbUrl,
    this.width,
    this.height,
    this.deletedAt,
    this.deletedByUid,
    this.reactions = const {},
    this.pollQuestion,
    this.pollOptions = const [],
    this.pollVotes = const {},
    this.pollAllowMultiple = false,
  });

  final String id;
  final String conversationId;
  final String clubId;
  final String type;
  final String? text;
  final String? storagePath;
  final String? downloadUrl;
  final String? thumbUrl;
  final double? width;
  final double? height;
  final String senderUid;
  final DateTime createdAt;
  final DateTime? deletedAt;
  final String? deletedByUid;
  final Map<String, List<String>> reactions;

  /// Question du sondage (`type == poll`).
  final String? pollQuestion;

  /// Options ordonnées.
  final List<ChatPollOption> pollOptions;

  /// Votes : optionId → uids.
  final Map<String, List<String>> pollVotes;

  /// Si true, plusieurs options peuvent être cochées.
  final bool pollAllowMultiple;

  bool get isDeleted => deletedAt != null;

  bool get isPoll => type == ChatMessageTypes.poll;

  /// Total de votes (toutes options).
  int get pollTotalVotes {
    var total = 0;
    for (final voters in pollVotes.values) {
      total += voters.length;
    }
    return total;
  }

  /// Nombre de votants uniques.
  int get pollUniqueVoterCount {
    final uids = <String>{};
    for (final voters in pollVotes.values) {
      uids.addAll(voters);
    }
    return uids.length;
  }

  /// True si [uid] a voté pour [optionId].
  bool hasVotedFor(String uid, String optionId) {
    return pollVotes[optionId]?.contains(uid) ?? false;
  }

  /// True si [uid] a déjà voté au moins une option.
  bool hasVoted(String uid) {
    for (final voters in pollVotes.values) {
      if (voters.contains(uid)) return true;
    }
    return false;
  }

  factory ChatMessage.fromFirestore({
    required String clubId,
    required String conversationId,
    required DocumentSnapshot<Map<String, dynamic>> doc,
  }) {
    final data = doc.data() ?? {};
    return ChatMessage(
      id: doc.id,
      clubId: clubId,
      conversationId: conversationId,
      type: data[FirestoreFields.type] as String? ?? ChatMessageTypes.text,
      text: data[FirestoreFields.text] as String? ??
          data[FirestoreFields.message] as String?,
      storagePath: data[FirestoreFields.storagePath] as String?,
      downloadUrl: data[FirestoreFields.downloadUrl] as String?,
      thumbUrl: data[FirestoreFields.thumbUrl] as String?,
      width: (data[FirestoreFields.width] as num?)?.toDouble(),
      height: (data[FirestoreFields.height] as num?)?.toDouble(),
      senderUid: data[FirestoreFields.senderUid] as String? ?? '',
      createdAt: _asDateTime(data[FirestoreFields.createdAt]) ?? DateTime.now(),
      deletedAt: _asDateTime(data[FirestoreFields.deletedAt]),
      deletedByUid: data[FirestoreFields.deletedByUid] as String?,
      reactions: _parseUidListsMap(data[FirestoreFields.reactions]),
      pollQuestion: data[FirestoreFields.pollQuestion] as String?,
      pollOptions: _parsePollOptions(data[FirestoreFields.pollOptions]),
      pollVotes: _parseUidListsMap(data[FirestoreFields.pollVotes]),
      pollAllowMultiple:
          data[FirestoreFields.pollAllowMultiple] as bool? ?? false,
    );
  }
}

List<ChatPollOption> _parsePollOptions(Object? raw) {
  if (raw is! List) return const [];
  final out = <ChatPollOption>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final option = ChatPollOption.fromMap(Map<String, dynamic>.from(item));
    if (option.id.isEmpty || option.text.isEmpty) continue;
    out.add(option);
  }
  return out;
}

Map<String, List<String>> _parseUidListsMap(Object? raw) {
  if (raw is! Map) return const {};
  final out = <String, List<String>>{};
  for (final entry in raw.entries) {
    final key = entry.key;
    if (key is! String || key.isEmpty) continue;
    final value = entry.value;
    if (value is! List) continue;
    out[key] = value.whereType<String>().toList(growable: false);
  }
  return out;
}

DateTime? _asDateTime(Object? raw) {
  if (raw is Timestamp) return raw.toDate();
  if (raw is DateTime) return raw;
  return null;
}
