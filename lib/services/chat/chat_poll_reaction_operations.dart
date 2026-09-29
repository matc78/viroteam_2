import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/services/chat/chat_helpers.dart';
import 'package:viro_team_v2/services/chat/chat_paths.dart';

/// Regroupe les mutations de sondages et réactions emoji.
class ChatPollReactionOperations {
  /// Crée le module dédié aux sondages et réactions.
  ChatPollReactionOperations({
    required FirebaseFirestore firestore,
    required ChatPaths paths,
  })  : _db = firestore,
        _paths = paths;

  final FirebaseFirestore _db;
  final ChatPaths _paths;

  /// Crée un sondage (groupes / canaux — pas les DM 1:1).
  Future<void> sendPollMessage({
    required String clubId,
    required String conversationId,
    required String senderUid,
    required String question,
    required List<String> optionTexts,
    bool allowMultiple = false,
    String? senderFirstName,
    String? senderRole,
  }) async {
    final trimmedQuestion = question.trim();
    final options = optionTexts
        .map((text) => text.trim())
        .where((text) => text.isNotEmpty)
        .toList();
    if (trimmedQuestion.isEmpty || options.length < 2) {
      throw ArgumentError('Sondage : question + au moins 2 options.');
    }
    if (options.length > 12) {
      throw ArgumentError('Sondage : 12 options max.');
    }

    final convSnap =
        await _paths.conversations(clubId).doc(conversationId).get();
    final convData = convSnap.data();
    final participants =
        (convData?[FirestoreFields.participantUids] as List<dynamic>?)
                ?.whereType<String>()
                .toList() ??
            const <String>[];
    // Aligné règles Firestore : `participantUids.size() > 2`.
    if (participants.length <= 2) {
      throw StateError('Les sondages sont réservés aux groupes (> 2).');
    }

    final pollOptions = <Map<String, dynamic>>[];
    final pollVotes = <String, List<String>>{};
    for (var i = 0; i < options.length; i++) {
      final id = 'o$i';
      pollOptions.add({'id': id, 'text': options[i]});
      pollVotes[id] = <String>[];
    }

    final ref = _paths.messages(clubId, conversationId).doc();
    final preview = '📊 $trimmedQuestion';
    final batch = _db.batch();
    batch.set(ref, {
      FirestoreFields.type: ChatMessageTypes.poll,
      FirestoreFields.text: trimmedQuestion,
      FirestoreFields.pollQuestion: trimmedQuestion,
      FirestoreFields.pollOptions: pollOptions,
      FirestoreFields.pollVotes: pollVotes,
      FirestoreFields.pollAllowMultiple: allowMultiple,
      FirestoreFields.senderUid: senderUid,
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
      FirestoreFields.reactions: <String, dynamic>{},
    });
    batch.update(_paths.conversations(clubId).doc(conversationId), {
      FirestoreFields.lastMessageAt: FieldValue.serverTimestamp(),
      FirestoreFields.lastMessagePreview: truncateChatText(
        preview,
        maxLength: 120,
      ),
      FirestoreFields.lastSenderUid: senderUid,
      if (trimToNull(senderFirstName) != null)
        FirestoreFields.lastSenderFirstName: trimToNull(senderFirstName),
      if (trimToNull(senderRole) != null)
        FirestoreFields.lastSenderRole: trimToNull(senderRole),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }

  /// Vote (ou retire le vote) sur une option de sondage.
  Future<void> votePollOption({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String optionId,
    required String uid,
  }) async {
    final ref = _paths.messages(clubId, conversationId).doc(messageId);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final data = snap.data() ?? {};
      if (data[FirestoreFields.type] != ChatMessageTypes.poll) {
        throw StateError('Pas un sondage');
      }
      if (data[FirestoreFields.deletedAt] != null) {
        throw StateError('Sondage supprimé');
      }

      final allowMultiple =
          data[FirestoreFields.pollAllowMultiple] as bool? ?? false;
      final votes = _parseUidListsMap(data[FirestoreFields.pollVotes]);
      final currentlySelected = votes[optionId]?.contains(uid) ?? false;

      if (allowMultiple) {
        final list = List<String>.from(votes[optionId] ?? const []);
        if (currentlySelected) {
          list.remove(uid);
        } else {
          list.add(uid);
        }
        if (list.isEmpty) {
          votes.remove(optionId);
        } else {
          votes[optionId] = list;
        }
      } else {
        // Choix unique : retire l’uid partout, puis (re)pose sur l’option.
        for (final key in votes.keys.toList()) {
          final list = List<String>.from(votes[key] ?? const []);
          list.remove(uid);
          if (list.isEmpty) {
            votes.remove(key);
          } else {
            votes[key] = list;
          }
        }
        if (!currentlySelected) {
          votes[optionId] = [...(votes[optionId] ?? const []), uid];
        }
      }

      tx.update(ref, {FirestoreFields.pollVotes: votes});
    });
  }

  /// Toggle réaction emoji (ajoute ou retire l’uid).
  Future<void> toggleReaction({
    required String clubId,
    required String conversationId,
    required String messageId,
    required String emoji,
    required String uid,
  }) async {
    final ref = _paths.messages(clubId, conversationId).doc(messageId);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final data = snap.data() ?? {};
      final reactions = _parseUidListsMap(data[FirestoreFields.reactions]);
      final current = List<String>.from(reactions[emoji] ?? const []);
      if (current.contains(uid)) {
        current.remove(uid);
      } else {
        current.add(uid);
      }
      if (current.isEmpty) {
        reactions.remove(emoji);
      } else {
        reactions[emoji] = current;
      }
      tx.update(ref, {FirestoreFields.reactions: reactions});
    });
  }

  Map<String, List<String>> _parseUidListsMap(Object? raw) {
    if (raw is! Map) return <String, List<String>>{};
    final out = <String, List<String>>{};
    for (final entry in raw.entries) {
      if (entry.key is! String) continue;
      final value = entry.value;
      out[entry.key as String] =
          value is List ? value.whereType<String>().toList() : <String>[];
    }
    return out;
  }
}
