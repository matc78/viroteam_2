import 'package:viro_team_v2/config/routes.dart';

/// Décide si une push reçue app ouverte doit être affichée en bannière.
///
/// Règle : on affiche tout, sauf si l'utilisateur regarde déjà le contenu
/// visé (ex. message d'une conversation ouverte à l'écran).
abstract final class ForegroundPushPolicy {
  /// [data] : payload `data` FCM ; [currentPath] : chemin go_router courant
  /// (`null` si inconnu). Retourne `false` si la bannière serait redondante.
  static bool shouldPresent({
    required Map<String, dynamic> data,
    required String? title,
    required String? body,
    required String? currentPath,
  }) {
    if ((title ?? '').trim().isEmpty && (body ?? '').trim().isEmpty) {
      return false;
    }
    if (currentPath == null) return true;

    final type = data['type']?.toString();
    if (type == 'chat_message') {
      final clubId = data['clubId']?.toString() ?? '';
      final conversationId = data['conversationId']?.toString() ?? '';
      if (clubId.isNotEmpty &&
          conversationId.isNotEmpty &&
          currentPath == AppRoutes.conversationPath(clubId, conversationId)) {
        return false;
      }
    }
    return true;
  }
}
