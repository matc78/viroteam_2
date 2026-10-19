import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/services/foreground_push_policy.dart';

void main() {
  group('ForegroundPushPolicy.shouldPresent', () {
    const chatData = <String, dynamic>{
      'type': 'chat_message',
      'clubId': 'club1',
      'conversationId': 'conv1',
    };

    test('affiche une annonce quel que soit l’écran', () {
      expect(
        ForegroundPushPolicy.shouldPresent(
          data: const {'type': 'announcement_published', 'clubId': 'club1'},
          title: 'Nouvelle annonce',
          body: 'Entraînement décalé',
          currentPath: '/home',
        ),
        isTrue,
      );
    });

    test('masque un message de la conversation ouverte', () {
      expect(
        ForegroundPushPolicy.shouldPresent(
          data: chatData,
          title: 'Léa',
          body: 'Salut',
          currentPath: '/conversations/club1/conv1',
        ),
        isFalse,
      );
    });

    test('affiche un message d’une autre conversation', () {
      expect(
        ForegroundPushPolicy.shouldPresent(
          data: chatData,
          title: 'Léa',
          body: 'Salut',
          currentPath: '/conversations/club1/conv2',
        ),
        isTrue,
      );
    });

    test('affiche si le chemin courant est inconnu', () {
      expect(
        ForegroundPushPolicy.shouldPresent(
          data: chatData,
          title: 'Léa',
          body: 'Salut',
          currentPath: null,
        ),
        isTrue,
      );
    });

    test('ignore une push sans titre ni texte', () {
      expect(
        ForegroundPushPolicy.shouldPresent(
          data: const {'type': 'event_modified'},
          title: ' ',
          body: null,
          currentPath: '/home',
        ),
        isFalse,
      );
    });
  });
}
