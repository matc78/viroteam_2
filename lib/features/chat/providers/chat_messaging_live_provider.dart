import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';

/// Messagerie visible : debug toujours ; release seulement si flag user.
bool resolveChatMessagingLive({
  required bool debugMode,
  required bool userFlag,
}) =>
    debugMode || userFlag;

/// Messagerie visible : toujours en debug ; en release seulement si
/// `users/{uid}.flags.chatMessaging == true`.
final chatMessagingLiveProvider = Provider<bool>((ref) {
  return resolveChatMessagingLive(
    debugMode: kDebugMode,
    userFlag: ref.watch(viroUserProvider).value?.chatMessaging ?? false,
  );
});
