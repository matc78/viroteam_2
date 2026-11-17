import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/chat/providers/chat_messaging_live_provider.dart';

void main() {
  group('resolveChatMessagingLive', () {
    test('debug : toujours visible', () {
      expect(
        resolveChatMessagingLive(debugMode: true, userFlag: false),
        isTrue,
      );
      expect(
        resolveChatMessagingLive(debugMode: true, userFlag: true),
        isTrue,
      );
    });

    test('release : visible seulement avec flags.chatMessaging', () {
      expect(
        resolveChatMessagingLive(debugMode: false, userFlag: false),
        isFalse,
      );
      expect(
        resolveChatMessagingLive(debugMode: false, userFlag: true),
        isTrue,
      );
    });
  });
}
