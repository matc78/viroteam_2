import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_helpers.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';

ChatConversation _conversationWith(String writePolicy) => ChatConversation(
      id: 'conv',
      clubId: 'club',
      type: ChatConversationTypes.category,
      title: 'Canal',
      participantUids: const ['coach', 'player'],
      writePolicy: writePolicy,
    );

void main() {
  group('chatThreadReadonlyHint', () {
    test('annonce les admins seuls sur un canal admins_only', () {
      expect(
        chatThreadReadonlyHint(_conversationWith(ChatWritePolicies.adminsOnly)),
        AppCopy.chat.readonlyHint,
      );
    });

    test('annonce coachs et admins sur un canal coaches_and_admins', () {
      expect(
        chatThreadReadonlyHint(
          _conversationWith(ChatWritePolicies.coachesAndAdmins),
        ),
        AppCopy.chat.readonlyHintCoachesAndAdmins,
      );
    });

    test('rien pour une conversation ouverte ou absente', () {
      expect(
        chatThreadReadonlyHint(_conversationWith(ChatWritePolicies.open)),
        isNull,
      );
      expect(chatThreadReadonlyHint(null), isNull);
    });
  });

  group('chatThreadCanWrite', () {
    final channel = _conversationWith(ChatWritePolicies.coachesAndAdmins);

    test('un coach écrit dans un canal coaches_and_admins', () {
      expect(chatThreadCanWrite(channel, 'coach', MemberRoles.coach), isTrue);
    });

    test('un joueur ne peut pas y écrire', () {
      expect(chatThreadCanWrite(channel, 'player', MemberRoles.player), isFalse);
    });
  });
}
