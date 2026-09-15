import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

/// ClubIds accessibles (membres + parents).
final chatClubIdsProvider = Provider<List<String>>((ref) {
  final clubs = ref.watch(userClubsProvider).value ?? const [];
  return clubs.map((e) => e.club.id).toList(growable: false);
});

String? _uidOf(Ref ref) => ref.watch(authStateProvider).value?.uid;

/// Backfill idempotent des chats système pour tous les clubs de la session.
///
/// Déclenché à l’ouverture de l’inbox : les clubs créés avant le chat
/// reçoivent leurs conversations `team` / `parents` / `staff` / `club`.
final chatEnsureSyncedProvider = FutureProvider<void>((ref) async {
  final uid = _uidOf(ref);
  if (uid == null || uid.isEmpty) return;
  final clubIds = ref.watch(chatClubIdsProvider);
  if (clubIds.isEmpty) return;
  final chat = ref.read(chatServiceProvider);
  await Future.wait(
    clubIds.map((clubId) async {
      try {
        await chat.ensureClubChatSynced(clubId: clubId);
      } catch (_) {
        // Best-effort : l’inbox reste utilisable même si un club échoue.
      }
    }),
  );
});

/// Inbox multi-clubs.
final chatInboxProvider = StreamProvider<List<ChatConversation>>((ref) {
  final uid = _uidOf(ref);
  if (uid == null || uid.isEmpty) {
    return Stream.value(const []);
  }
  // Lance le backfill une fois (écoute pour invalidation si clubs changent).
  ref.watch(chatEnsureSyncedProvider);
  final clubIds = ref.watch(chatClubIdsProvider);
  return ref.watch(chatServiceProvider).watchInbox(uid: uid, clubIds: clubIds);
});

/// États mute / unread.
final chatStatesProvider = StreamProvider<Map<String, ChatUserState>>((ref) {
  final uid = _uidOf(ref);
  if (uid == null || uid.isEmpty) {
    return Stream.value(const {});
  }
  return ref.watch(chatServiceProvider).watchChatStates(uid);
});

/// Total unread pour le badge dock.
final chatTotalUnreadProvider = Provider<int>((ref) {
  final states = ref.watch(chatStatesProvider).value ?? const {};
  var total = 0;
  for (final state in states.values) {
    if (!state.muted) {
      total += state.unreadCount;
    }
  }
  return total;
});

/// Messages d’un thread.
final chatMessagesProvider = StreamProvider.family<
    List<ChatMessage>,
    ({String clubId, String conversationId})>((ref, key) {
  return ref.watch(chatServiceProvider).watchMessages(
        clubId: key.clubId,
        conversationId: key.conversationId,
      );
});

final chatConversationProvider = StreamProvider.family<
    ChatConversation?,
    ({String clubId, String conversationId})>((ref, key) {
  return ref.watch(chatServiceProvider).watchConversation(
        clubId: key.clubId,
        conversationId: key.conversationId,
      );
});
