import 'dart:async';

/// `switchMap` pour les flux Firestore imbriqués.
///
/// À utiliser à la place de [Stream.asyncExpand] dès que le flux interne ne se
/// termine jamais (`snapshots()`) : `asyncExpand` met la source en pause
/// jusqu'à la fin du flux interne, donc les émissions suivantes de la source
/// (nouvelle équipe, changement de saison…) ne sont jamais prises en compte.
extension SwitchMapStream<T> on Stream<T> {
  /// Pour chaque valeur de la source, s'abonne à `mapper(valeur)` et annule
  /// l'abonnement interne précédent. Se termine quand la source et le dernier
  /// flux interne sont terminés.
  Stream<R> switchMap<R>(Stream<R> Function(T value) mapper) {
    late final StreamController<R> controller;
    StreamSubscription<T>? sourceSubscription;
    StreamSubscription<R>? innerSubscription;
    var sourceDone = false;

    void closeIfDone() {
      if (sourceDone && innerSubscription == null) controller.close();
    }

    void onSourceValue(T value) {
      final previous = innerSubscription;
      innerSubscription = null;
      if (previous != null) unawaited(previous.cancel());

      final Stream<R> inner;
      try {
        inner = mapper(value);
      } catch (error, stackTrace) {
        controller.addError(error, stackTrace);
        return;
      }

      late final StreamSubscription<R> subscription;
      subscription = inner.listen(
        controller.add,
        onError: controller.addError,
        onDone: () {
          if (!identical(innerSubscription, subscription)) return;
          innerSubscription = null;
          closeIfDone();
        },
      );
      innerSubscription = subscription;
    }

    controller = StreamController<R>(
      onListen: () {
        sourceSubscription = listen(
          onSourceValue,
          onError: controller.addError,
          onDone: () {
            sourceDone = true;
            closeIfDone();
          },
        );
      },
      onPause: () {
        sourceSubscription?.pause();
        innerSubscription?.pause();
      },
      onResume: () {
        sourceSubscription?.resume();
        innerSubscription?.resume();
      },
      onCancel: () async {
        final inner = innerSubscription;
        innerSubscription = null;
        await Future.wait([
          if (inner != null) inner.cancel(),
          if (sourceSubscription != null) sourceSubscription!.cancel(),
        ]);
      },
    );

    return controller.stream;
  }
}
