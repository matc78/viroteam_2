import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Statut d’envoi local (UI only, pas Firestore).
enum ChatMessageLocalStatus {
  sending,
  failed,
}

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
    this.editedAt,
    this.reactions = const {},
    this.pollQuestion,
    this.pollOptions = const [],
    this.pollVotes = const {},
    this.pollAllowMultiple = false,
    this.replyToMessageId,
    this.replyToText,
    this.replyToSenderUid,
    this.localStatus,
    this.localImageBytes,
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
  final DateTime? editedAt;
  final Map<String, List<String>> reactions;

  /// Question du sondage (`type == poll`).
  final String? pollQuestion;

  /// Options ordonnées.
  final List<ChatPollOption> pollOptions;

  /// Votes : optionId → uids.
  final Map<String, List<String>> pollVotes;

  /// Si true, plusieurs options peuvent être cochées.
  final bool pollAllowMultiple;

  /// Id du message cité (reply).
  final String? replyToMessageId;

  /// Extrait du message cité.
  final String? replyToText;

  /// Auteur du message cité.
  final String? replyToSenderUid;

  /// Statut d’envoi optimiste (null = message serveur confirmé).
  final ChatMessageLocalStatus? localStatus;

  /// Aperçu local d’une photo en cours d’envoi (pas persisté).
  final Uint8List? localImageBytes;

  bool get isDeleted => deletedAt != null;

  bool get isPoll => type == ChatMessageTypes.poll;

  bool get isLocalPending => localStatus != null;

  bool get isSending => localStatus == ChatMessageLocalStatus.sending;

  bool get isSendFailed => localStatus == ChatMessageLocalStatus.failed;

  bool get hasReply =>
      (replyToMessageId ?? '').isNotEmpty &&
      (replyToText ?? '').trim().isNotEmpty;

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

  /// Copie avec champs locaux / champs message mis à jour.
  ChatMessage copyWith({
    String? id,
    ChatMessageLocalStatus? localStatus,
    bool clearLocalStatus = false,
    Uint8List? localImageBytes,
    bool clearLocalImageBytes = false,
    String? text,
    String? downloadUrl,
    String? thumbUrl,
    DateTime? createdAt,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      conversationId: conversationId,
      clubId: clubId,
      type: type,
      senderUid: senderUid,
      createdAt: createdAt ?? this.createdAt,
      text: text ?? this.text,
      storagePath: storagePath,
      downloadUrl: downloadUrl ?? this.downloadUrl,
      thumbUrl: thumbUrl ?? this.thumbUrl,
      width: width,
      height: height,
      deletedAt: deletedAt,
      deletedByUid: deletedByUid,
      editedAt: editedAt,
      reactions: reactions,
      pollQuestion: pollQuestion,
      pollOptions: pollOptions,
      pollVotes: pollVotes,
      pollAllowMultiple: pollAllowMultiple,
      replyToMessageId: replyToMessageId,
      replyToText: replyToText,
      replyToSenderUid: replyToSenderUid,
      localStatus: clearLocalStatus ? null : (localStatus ?? this.localStatus),
      localImageBytes: clearLocalImageBytes
          ? null
          : (localImageBytes ?? this.localImageBytes),
    );
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
      editedAt: _asDateTime(data[FirestoreFields.editedAt]),
      reactions: _parseUidListsMap(data[FirestoreFields.reactions]),
      pollQuestion: data[FirestoreFields.pollQuestion] as String?,
      pollOptions: _parsePollOptions(data[FirestoreFields.pollOptions]),
      pollVotes: _parseUidListsMap(data[FirestoreFields.pollVotes]),
      pollAllowMultiple:
          data[FirestoreFields.pollAllowMultiple] as bool? ?? false,
      replyToMessageId: data[FirestoreFields.replyToMessageId] as String?,
      replyToText: data[FirestoreFields.replyToText] as String?,
      replyToSenderUid: data[FirestoreFields.replyToSenderUid] as String?,
    );
  }

  /// Sérialisation cache disque (ISO8601, sans Timestamp Firestore).
  Map<String, dynamic> toLocalMap() => {
        'id': id,
        'conversationId': conversationId,
        'clubId': clubId,
        'type': type,
        'text': text,
        'storagePath': storagePath,
        'downloadUrl': downloadUrl,
        'thumbUrl': thumbUrl,
        'width': width,
        'height': height,
        'senderUid': senderUid,
        'createdAt': createdAt.toIso8601String(),
        'deletedAt': deletedAt?.toIso8601String(),
        'deletedByUid': deletedByUid,
        'editedAt': editedAt?.toIso8601String(),
        'reactions': reactions,
        'pollQuestion': pollQuestion,
        'pollOptions': pollOptions.map((o) => o.toMap()).toList(),
        'pollVotes': pollVotes,
        'pollAllowMultiple': pollAllowMultiple,
        'replyToMessageId': replyToMessageId,
        'replyToText': replyToText,
        'replyToSenderUid': replyToSenderUid,
      };

  /// Désérialisation depuis le cache local.
  factory ChatMessage.fromLocalMap(Map<String, dynamic> map) {
    return ChatMessage(
      id: map['id'] as String? ?? '',
      conversationId: map['conversationId'] as String? ?? '',
      clubId: map['clubId'] as String? ?? '',
      type: map['type'] as String? ?? ChatMessageTypes.text,
      text: map['text'] as String?,
      storagePath: map['storagePath'] as String?,
      downloadUrl: map['downloadUrl'] as String?,
      thumbUrl: map['thumbUrl'] as String?,
      width: (map['width'] as num?)?.toDouble(),
      height: (map['height'] as num?)?.toDouble(),
      senderUid: map['senderUid'] as String? ?? '',
      createdAt: _asLocalDateTime(map['createdAt']) ?? DateTime.now(),
      deletedAt: _asLocalDateTime(map['deletedAt']),
      deletedByUid: map['deletedByUid'] as String?,
      editedAt: _asLocalDateTime(map['editedAt']),
      reactions: _parseUidListsMap(map['reactions']),
      pollQuestion: map['pollQuestion'] as String?,
      pollOptions: _parsePollOptions(map['pollOptions']),
      pollVotes: _parseUidListsMap(map['pollVotes']),
      pollAllowMultiple: map['pollAllowMultiple'] as bool? ?? false,
      replyToMessageId: map['replyToMessageId'] as String?,
      replyToText: map['replyToText'] as String?,
      replyToSenderUid: map['replyToSenderUid'] as String?,
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

DateTime? _asLocalDateTime(Object? raw) {
  if (raw is DateTime) return raw;
  if (raw is String && raw.isNotEmpty) return DateTime.tryParse(raw);
  return null;
}
