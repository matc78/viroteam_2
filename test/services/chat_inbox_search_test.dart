import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/services/chat/chat_inbox_search.dart';

ChatConversation _conversation(
  String id, {
  String clubId = 'club',
  String type = ChatConversationTypes.team,
  String title = '',
  String preview = '',
  String? senderFirstName,
}) =>
    ChatConversation(
      id: id,
      clubId: clubId,
      type: type,
      title: title,
      participantUids: const ['me', 'peer'],
      writePolicy: ChatWritePolicies.open,
      lastMessagePreview: preview,
      lastSenderFirstName: senderFirstName,
    );

void main() {
  final conversations = [
    _conversation('u15', title: 'U15 Garçons', preview: 'Entraînement à 18h'),
    _conversation(
      'dm',
      type: ChatConversationTypes.dm,
      title: 'Titre figé',
      senderFirstName: 'Léa',
    ),
    _conversation('other', clubId: 'club2', title: 'Seniors'),
  ];
  const clubNames = {'club': 'AS Viro', 'club2': 'FC Rivière'};
  const peers = {'club|dm': 'Karim Coach'};

  List<String> idsFor(String raw) => filterInboxConversations(
        conversations,
        query: normalizeInboxQuery(raw),
        clubNameById: clubNames,
        peerNameByKey: peers,
      ).map((c) => c.id).toList();

  test('requête vide → toutes les discussions, ordre conservé', () {
    expect(idsFor('   '), ['u15', 'dm', 'other']);
  });

  test('cherche dans le titre, insensible à la casse', () {
    expect(idsFor('u15 GAR'), ['u15']);
  });

  test('DM : cherche le nom de l’interlocuteur, pas le titre figé', () {
    expect(idsFor('karim'), ['dm']);
    expect(idsFor('figé'), isEmpty);
  });

  test('cherche le nom du club', () {
    expect(idsFor('rivière'), ['other']);
  });

  test('cherche le dernier message et le prénom de son auteur', () {
    expect(idsFor('18h'), ['u15']);
    expect(idsFor('léa'), ['dm']);
  });

  test('aucun résultat', () {
    expect(idsFor('handball'), isEmpty);
  });

  test('chatInboxKey', () {
    expect(chatInboxKey('c', 'x'), 'c|x');
  });
}
