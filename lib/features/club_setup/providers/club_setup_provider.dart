import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club_setup/services/french_address_service.dart';
import 'package:viro_team_v2/features/club_setup/services/club_setup_persistence_service.dart';

class ClubSetupNotifier extends Notifier<ClubSetupDraft> {
  String? _userId;
  Timer? _persistDebounce;

  ClubSetupPersistenceService get _persistence =>
      ref.read(clubSetupPersistenceServiceProvider);

  @override
  ClubSetupDraft build() => ClubSetupDraft();

  /// Associe le brouillon à un utilisateur (clé de persistance).
  void setUserId(String userId) {
    _userId = userId;
  }

  /// Restaure le brouillon local ; retourne `true` si un brouillon existait.
  Future<bool> restoreForUser(String userId) async {
    _userId = userId;
    final saved = await _persistence.load(userId);
    if (saved == null) return false;
    state = saved;
    return true;
  }

  void reset() {
    _persistDebounce?.cancel();
    state = ClubSetupDraft();
  }

  /// Réinitialise l'état et efface la persistance locale.
  Future<void> resetAndClear(String userId) async {
    _persistDebounce?.cancel();
    _userId = userId;
    await _persistence.clear(userId);
    state = ClubSetupDraft();
  }

  void updateDraft(ClubSetupDraft Function(ClubSetupDraft) updater) {
    state = updater(state.copy());
    _schedulePersist();
  }

  void toggleObjective(String key) {
    final next = Set<String>.from(state.objectives);
    if (next.contains(key)) {
      next.remove(key);
    } else {
      next.add(key);
    }
    state = state.copy()..objectives = next;
    _schedulePersist();
  }

  void setCurrentStep(int step) {
    state = state.copy()..currentStep = step;
    _schedulePersist();
  }

  /// Enregistre le logo en mémoire et sur disque, puis persiste le brouillon.
  Future<void> setLogoBytes(Uint8List bytes) async {
    final userId = _userId;
    if (userId == null) {
      state = state.copy()..logoBytes = bytes;
      return;
    }
    final path = await _persistence.saveLogoBytes(userId, bytes);
    state = state.copy()
      ..logoBytes = bytes
      ..logoFilePath = path;
    await persistImmediately();
  }

  void _schedulePersist() {
    _persistDebounce?.cancel();
    _persistDebounce = Timer(const Duration(milliseconds: 300), () {
      unawaited(persistImmediately());
    });
  }

  /// Sauvegarde immédiate (lifecycle background, submit intermédiaire).
  Future<void> persistImmediately() async {
    final userId = _userId;
    if (userId == null) return;
    await _persistence.save(userId, state);
  }
}

final clubSetupPersistenceServiceProvider =
    Provider<ClubSetupPersistenceService>(
  (ref) => ClubSetupPersistenceService(),
);

final frenchAddressServiceProvider = Provider<FrenchAddressService>((ref) {
  final service = FrenchAddressService();
  ref.onDispose(service.dispose);
  return service;
});

final clubSetupProvider =
    NotifierProvider<ClubSetupNotifier, ClubSetupDraft>(ClubSetupNotifier.new);
