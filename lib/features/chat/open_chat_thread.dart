import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/features/chat/chat_thread_open_seed.dart';
import 'package:viro_team_v2/features/chat/providers/chat_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';

/// Ouvre un fil avec chrome immédiat (seed) + prefetch streams, style WhatsApp.
///
/// [router] : à passer quand [context] peut être invalidé (ex. après pop d’une sheet).
void openChatThread(
  BuildContext context,
  WidgetRef ref, {
  required String clubId,
  required String conversationId,
  required String title,
  required Color clubColor,
  String? initial,
  String? avatarUrl,
  bool isGroup = false,
  bool isChannel = false,
  GoRouter? router,
}) {
  ref.read(
    chatMessagesProvider((
      clubId: clubId,
      conversationId: conversationId,
    )),
  );
  ref.read(
    chatConversationProvider((
      clubId: clubId,
      conversationId: conversationId,
    )),
  );
  ref.read(clubMembersProvider(clubId));

  final go = router ?? GoRouter.of(context);
  go.push(
    AppRoutes.conversationPath(clubId, conversationId),
    extra: ChatThreadOpenSeed(
      title: title,
      clubColor: clubColor,
      initial: initial,
      avatarUrl: avatarUrl,
      isGroup: isGroup,
      isChannel: isChannel,
    ),
  );
}
