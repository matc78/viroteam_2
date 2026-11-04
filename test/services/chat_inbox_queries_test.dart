import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/services/chat/chat_inbox_queries.dart';

ChatConversation _conversation(
  String id, {
  String clubId = 'club',
  DateTime? lastMessageAt,
  DateTime? createdAt,
}) =>
    ChatConversation(
      id: id,
      clubId: clubId,
      type: ChatConversationTypes.team,
      title: id,
      participantUids: const ['a', 'b', 'c'],
      writePolicy: ChatWritePolicies.open,
      lastMessageAt: lastMessageAt,
      createdAt: createdAt,
    );

void main() {
  group('ChatInboxQueries.sortInboxConversations', () {
    final monday = DateTime(2026, 11, 2);
    final tuesday = DateTime(2026, 11, 3);
    final wednesday = DateTime(2026, 11, 4);

    test('plus récente activité en tête', () {
      final sorted = ChatInboxQueries.sortInboxConversations(
        [
          _conversation('old', lastMessageAt: monday),
          _conversation('new', lastMessageAt: wednesday),
          _conversation('mid', lastMessageAt: tuesday),
        ],
        const {},
      );
      expect(sorted.map((c) => c.id), ['new', 'mid', 'old']);
    });

    test('les favoris passent devant, triés entre eux par date', () {
      final sorted = ChatInboxQueries.sortInboxConversations(
        [
          _conversation('recent', lastMessageAt: wednesday),
          _conversation('favOld', lastMessageAt: monday),
          _conversation('favNew', lastMessageAt: tuesday),
        ],
        {
          ChatUserState.docId('club', 'favOld'):
              ChatUserState(id: 'club_favOld', favorite: true),
          ChatUserState.docId('club', 'favNew'):
              ChatUserState(id: 'club_favNew', favorite: true),
        },
      );
      expect(sorted.map((c) => c.id), ['favNew', 'favOld', 'recent']);
    });

    test('sans message : date de création, sinon en dernier', () {
      final sorted = ChatInboxQueries.sortInboxConversations(
        [
          _conversation('nothing'),
          _conversation('created', createdAt: tuesday),
          _conversation('message', lastMessageAt: monday),
        ],
        const {},
      );
      expect(sorted.map((c) => c.id), ['created', 'message', 'nothing']);
    });

    test('le favori est propre au club', () {
      final sorted = ChatInboxQueries.sortInboxConversations(
        [
          _conversation('same', clubId: 'other', lastMessageAt: wednesday),
          _conversation('same', clubId: 'club', lastMessageAt: monday),
        ],
        {
          ChatUserState.docId('club', 'same'):
              ChatUserState(id: 'club_same', favorite: true),
        },
      );
      expect(sorted.map((c) => c.clubId), ['club', 'other']);
    });

    test('ne modifie pas la liste reçue', () {
      final input = [
        _conversation('a', lastMessageAt: monday),
        _conversation('b', lastMessageAt: tuesday),
      ];
      ChatInboxQueries.sortInboxConversations(input, const {});
      expect(input.map((c) => c.id), ['a', 'b']);
    });
  });
}
