import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/push_channels.dart';
import 'package:viro_team_v2/services/local_notification_service.dart';

void main() {
  group('PushChannel', () {
    test('résout le canal par preferenceKey, repli sur events', () {
      expect(
        PushChannel.forPreferenceKey('announcements'),
        PushChannel.announcements,
      );
      expect(PushChannel.forPreferenceKey('rsvp'), PushChannel.rsvp);
      expect(PushChannel.forPreferenceKey('inconnu'), PushChannel.fallback);
      expect(PushChannel.forPreferenceKey(null), PushChannel.events);
    });

    test('ids alignés avec les Functions et le manifest Android', () {
      final functionsSource = File(
        'functions/src/notifications/fcmMessage.ts',
      ).readAsStringSync();
      final manifest = File(
        'android/app/src/main/AndroidManifest.xml',
      ).readAsStringSync();
      for (final channel in PushChannel.values) {
        expect(
          functionsSource,
          contains('${channel.preferenceKey}: "${channel.id}"'),
          reason: 'ANDROID_CHANNEL_IDS doit déclarer ${channel.id}',
        );
      }
      expect(manifest, contains('android:value="${PushChannel.fallback.id}"'));
    });

    test('chaque canal a un nom et une description', () {
      for (final channel in PushChannel.values) {
        expect(LocalNotificationService.channelName(channel), isNotEmpty);
        expect(
          LocalNotificationService.channelDescription(channel),
          isNotEmpty,
        );
      }
    });
  });

  group('stableNotificationId', () {
    test('stable pour un même tag, distinct entre tags', () {
      expect(
        stableNotificationId('event_e1'),
        stableNotificationId('event_e1'),
      );
      expect(
        stableNotificationId('event_e1'),
        isNot(stableNotificationId('event_e2')),
      );
    });

    test('reste dans [1, 2^30) : jamais 0 ni dans la plage sans tag', () {
      for (final tag in ['a', 'event_e1', 'announcement_${'x' * 200}']) {
        final id = stableNotificationId(tag);
        expect(id, greaterThan(0));
        expect(id, lessThan(0x40000000));
      }
    });
  });
}
