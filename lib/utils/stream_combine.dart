import 'dart:async';

/// Combine plusieurs streams de listes en un seul stream fusionné.
///
/// S’abonne aux sources seulement quand un listener est présent (évite de
/// perdre les premières émissions — ex. [Stream.value] — avec un broadcast).
Stream<List<T>> combineLatestListStreams<T>(List<Stream<List<T>>> streams) {
  if (streams.isEmpty) return Stream.value([]);

  final latest = List<List<T>?>.filled(streams.length, null);
  final subscriptions = <StreamSubscription<List<T>>>[];
  late final StreamController<List<T>> controller;

  void emitIfReady() {
    if (latest.every((e) => e != null)) {
      controller.add(latest.expand((e) => e!).toList());
    }
  }

  controller = StreamController<List<T>>(
    onListen: () {
      for (var i = 0; i < streams.length; i++) {
        final index = i;
        subscriptions.add(
          streams[i].listen(
            (data) {
              latest[index] = data;
              emitIfReady();
            },
            onError: controller.addError,
          ),
        );
      }
    },
    onCancel: () async {
      for (final sub in subscriptions) {
        await sub.cancel();
      }
      subscriptions.clear();
      for (var i = 0; i < latest.length; i++) {
        latest[i] = null;
      }
    },
  );

  return controller.stream;
}
