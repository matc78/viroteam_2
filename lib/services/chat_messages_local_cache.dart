import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:viro_team_v2/models/chat_message.dart';

/// Cache disque de la fenêtre live des messages (style WhatsApp / Telegram).
///
/// Lit avant le premier snapshot Firestore pour peindre le fil immédiatement
/// à la réouverture ; réécrit à chaque snapshot live.
class ChatMessagesLocalCache {
  Directory? _dir;

  /// Répertoire `chat_msg_cache` sous les documents de l’app.
  Future<Directory> _cacheDir() async {
    final existing = _dir;
    if (existing != null) return existing;
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory('${docs.path}/chat_msg_cache');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return _dir = dir;
  }

  /// Chemin fichier pour une conversation.
  Future<File> _file({
    required String clubId,
    required String conversationId,
  }) async {
    final dir = await _cacheDir();
    final safeClub = clubId.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final safeConv =
        conversationId.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    return File('${dir.path}/${safeClub}__$safeConv.json');
  }

  /// Lit la dernière fenêtre mise en cache, ou `null` si absente / invalide.
  Future<List<ChatMessage>?> read({
    required String clubId,
    required String conversationId,
  }) async {
    try {
      final file = await _file(
        clubId: clubId,
        conversationId: conversationId,
      );
      if (!await file.exists()) return null;
      final raw = await file.readAsString();
      if (raw.trim().isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! List) return null;
      final out = <ChatMessage>[];
      for (final item in decoded) {
        if (item is! Map) continue;
        final message =
            ChatMessage.fromLocalMap(Map<String, dynamic>.from(item));
        if (message.id.isEmpty) continue;
        out.add(message);
      }
      return out;
    } catch (_) {
      return null;
    }
  }

  /// Persiste la fenêtre live (best-effort, non bloquant pour l’UI).
  Future<void> write({
    required String clubId,
    required String conversationId,
    required List<ChatMessage> messages,
  }) async {
    try {
      final file = await _file(
        clubId: clubId,
        conversationId: conversationId,
      );
      final payload = messages.map((m) => m.toLocalMap()).toList(growable: false);
      await file.writeAsString(jsonEncode(payload), flush: true);
    } catch (_) {
      // Best-effort : le fil reste utilisable sans cache.
    }
  }
}
