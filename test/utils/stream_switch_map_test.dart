import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/utils/stream_switch_map.dart';

void main() {
  group('switchMap', () {
    test(
      'suit chaque nouvelle valeur de la source malgré un flux interne infini',
      () async {
        final source = StreamController<String>();
        final inners = <String, StreamController<int>>{
          'a': StreamController<int>(),
          'b': StreamController<int>(),
        };
        final received = <int>[];
        final subscription = source.stream
            .switchMap((key) => inners[key]!.stream)
            .listen(received.add);

        source.add('a');
        await pumpEventQueue();
        inners['a']!.add(1);
        await pumpEventQueue();

        // Avec asyncExpand, 'b' resterait bloqué derrière le flux 'a' infini.
        source.add('b');
        await pumpEventQueue();
        inners['b']!.add(2);
        inners['a']!.add(99); // ancien flux : ignoré
        await pumpEventQueue();

        expect(received, [1, 2]);
        expect(inners['a']!.hasListener, isFalse);

        await subscription.cancel();
        expect(inners['b']!.hasListener, isFalse);
        expect(source.hasListener, isFalse);
      },
    );

    test(
      'se termine quand la source et le dernier flux interne sont finis',
      () async {
        final values = await Stream.fromIterable([
          1,
          2,
        ]).switchMap((value) => Stream.value(value * 10)).toList();
        expect(values, [10, 20]);
      },
    );

    test('remonte l’erreur du mapper sans couper le flux', () async {
      final source = StreamController<int>();
      final received = <int>[];
      final errors = <Object>[];
      final subscription = source.stream
          .switchMap((value) {
            if (value == 0) throw StateError('zéro');
            return Stream.value(value);
          })
          .listen(received.add, onError: errors.add);

      source
        ..add(0)
        ..add(3);
      await pumpEventQueue();

      expect(errors, hasLength(1));
      expect(received, [3]);
      await subscription.cancel();
    });
  });
}
