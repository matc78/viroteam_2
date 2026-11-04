import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/chat/widgets/conversation_info_sheet.dart';
import 'package:viro_team_v2/models/chat_message.dart';

ChatMessage _message(
  String id, {
  String type = ChatMessageTypes.text,
  String? text,
  String? thumbUrl,
  String? downloadUrl,
  DateTime? deletedAt,
}) =>
    ChatMessage(
      id: id,
      conversationId: 'conv',
      clubId: 'club',
      type: type,
      senderUid: 'u1',
      createdAt: DateTime(2026, 11, 3),
      text: text,
      thumbUrl: thumbUrl,
      downloadUrl: downloadUrl,
      deletedAt: deletedAt,
    );

void main() {
  group('extractConversationMedia', () {
    test('photos : vignette d’abord, sinon image pleine', () {
      final media = extractConversationMedia([
        _message(
          'a',
          type: ChatMessageTypes.image,
          thumbUrl: 'https://cdn.test/a_thumb.jpg',
          downloadUrl: 'https://cdn.test/a.jpg',
        ),
        _message(
          'b',
          type: ChatMessageTypes.image,
          downloadUrl: 'https://cdn.test/b.jpg',
        ),
        _message('c', type: ChatMessageTypes.image),
      ]);
      expect(media.imageUrls, [
        'https://cdn.test/a_thumb.jpg',
        'https://cdn.test/b.jpg',
      ]);
    });

    test('liens dédoublonnés, dans l’ordre d’apparition', () {
      final media = extractConversationMedia([
        _message('a', text: 'Le planning : https://viroteam.fr/planning'),
        _message(
          'b',
          text: 'https://viroteam.fr/planning et https://exemple.test/doc',
        ),
      ]);
      expect(media.linkUrls, [
        'https://viroteam.fr/planning',
        'https://exemple.test/doc',
      ]);
      expect(media.imageUrls, isEmpty);
    });

    test('ignore les messages supprimés', () {
      final media = extractConversationMedia([
        _message(
          'a',
          type: ChatMessageTypes.image,
          thumbUrl: 'https://cdn.test/a.jpg',
          deletedAt: DateTime(2026, 11, 3),
        ),
        _message(
          'b',
          text: 'https://exemple.test',
          deletedAt: DateTime(2026, 11, 3),
        ),
      ]);
      expect(media.imageUrls, isEmpty);
      expect(media.linkUrls, isEmpty);
    });
  });
}
