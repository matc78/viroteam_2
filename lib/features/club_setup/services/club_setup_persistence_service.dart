import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';

/// Persistance locale du brouillon wizard création club (reprise après fermeture).
class ClubSetupPersistenceService {
  ClubSetupPersistenceService({SharedPreferences? preferences})
      : _preferences = preferences;

  SharedPreferences? _preferences;

  static String _prefsKey(String userId) => 'club_setup_draft_v1_$userId';

  static String logoFileName(String userId) => 'club_setup_logo_$userId.jpg';

  Future<SharedPreferences> _prefs() async {
    return _preferences ??= await SharedPreferences.getInstance();
  }

  /// Charge le brouillon persisté pour [userId], ou `null` si absent.
  Future<ClubSetupDraft?> load(String userId) async {
    final prefs = await _prefs();
    final raw = prefs.getString(_prefsKey(userId));
    if (raw == null || raw.isEmpty) return null;

    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final draft = ClubSetupDraft.fromJson(json);
      if (draft.logoFilePath != null) {
        final file = File(draft.logoFilePath!);
        if (await file.exists()) {
          draft.logoBytes = await file.readAsBytes();
        } else {
          draft.logoFilePath = null;
        }
      }
      return draft;
    } catch (_) {
      return null;
    }
  }

  /// Sauvegarde le brouillon pour [userId].
  Future<void> save(String userId, ClubSetupDraft draft) async {
    final prefs = await _prefs();
    await prefs.setString(_prefsKey(userId), jsonEncode(draft.toJson()));
  }

  /// Efface le brouillon et le logo temporaire pour [userId].
  Future<void> clear(String userId) async {
    final prefs = await _prefs();
    await prefs.remove(_prefsKey(userId));

    final tempDir = await getTemporaryDirectory();
    final logoFile = File('${tempDir.path}/${logoFileName(userId)}');
    if (await logoFile.exists()) {
      await logoFile.delete();
    }
  }

  /// Écrit les bytes logo dans un fichier temporaire et retourne le chemin.
  Future<String> saveLogoBytes(String userId, Uint8List bytes) async {
    final tempDir = await getTemporaryDirectory();
    final file = File('${tempDir.path}/${logoFileName(userId)}');
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }
}
