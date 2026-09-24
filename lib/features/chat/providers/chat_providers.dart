import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
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

/// Annuaire `clubId|uid` → (prénom, rôle) pour les previews inbox.
final chatPreviewSendersProvider =
    FutureProvider<Map<String, ({String firstName, String role})>>((ref) async {
  final clubIds = ref.watch(chatClubIdsProvider);
  if (clubIds.isEmpty) return const {};
  final memberService = ref.read(memberServiceProvider);
  final out = <String, ({String firstName, String role})>{};
  await Future.wait(
    clubIds.map((clubId) async {
      // Parent : `list` members refusé — skip (previews restent sans prénom).
      if (ref.read(isGuardianOnlyInClubProvider(clubId))) return;
      try {
        final members =
            await memberService.watchClubMembers(clubId).first;
        for (final member in members) {
          final accountUid = member.accountUid;
          if (accountUid == null || accountUid.isEmpty) continue;
          final fromFirst = member.firstName?.trim() ?? '';
          final firstName = fromFirst.isNotEmpty
              ? fromFirst
              : (member.displayName?.trim().split(RegExp(r'\s+')).firstOrNull ??
                  '');
          if (firstName.isEmpty) continue;
          out['$clubId|$accountUid'] = (
            firstName: firstName,
            role: member.role,
          );
        }
      } catch (_) {
        // Best-effort pour la preview.
      }
    }),
  );
  return out;
});

/// Noms des pairs DM pour le viewer : `clubId|convId` → displayName.
///
/// Le `title` Firestore est figé au nom de la cible à la création ; sans
/// résolution côté viewer, le destinataire voit son propre nom.
final chatDmPeerTitlesProvider =
    FutureProvider<Map<String, String>>((ref) async {
  final uid = _uidOf(ref);
  if (uid == null || uid.isEmpty) return const {};
  final conversations = ref.watch(chatInboxProvider).value ?? const [];
  if (conversations.isEmpty) return const {};

  final memberService = ref.read(memberServiceProvider);
  final userService = ref.read(userServiceProvider);
  final displayByClubUid = <String, String>{};

  final clubIds = {
    for (final conversation in conversations) conversation.clubId,
  };
  await Future.wait(
    clubIds.map((clubId) async {
      if (ref.read(isGuardianOnlyInClubProvider(clubId))) return;
      try {
        final members = await memberService.watchClubMembers(clubId).first;
        for (final member in members) {
          final accountUid = member.accountUid;
          if (accountUid == null || accountUid.isEmpty) continue;
          final name = (member.displayName ?? '').trim();
          if (name.isEmpty) continue;
          displayByClubUid['$clubId|$accountUid'] = name;
        }
      } catch (_) {
        // Best-effort.
      }
    }),
  );

  final out = <String, String>{};
  final missingUids = <String>{};
  for (final conversation in conversations) {
    final peerUid = conversation.peerUidFor(uid);
    if (peerUid == null) continue;
    final fromMember = displayByClubUid['${conversation.clubId}|$peerUid'];
    if (fromMember != null && fromMember.isNotEmpty) {
      out['${conversation.clubId}|${conversation.id}'] = fromMember;
    } else {
      missingUids.add(peerUid);
    }
  }

  final profileNameByUid = <String, String>{};
  await Future.wait(
    missingUids.map((peerUid) async {
      try {
        final user = await userService.getUser(peerUid);
        if (user == null) return;
        final name = user.displayName.trim().isNotEmpty
            ? user.displayName.trim()
            : [user.firstName, user.lastName]
                .where((part) => part.trim().isNotEmpty)
                .join(' ')
                .trim();
        if (name.isNotEmpty) profileNameByUid[peerUid] = name;
      } catch (_) {
        // Best-effort.
      }
    }),
  );

  for (final conversation in conversations) {
    final key = '${conversation.clubId}|${conversation.id}';
    if (out.containsKey(key)) continue;
    final peerUid = conversation.peerUidFor(uid);
    if (peerUid == null) continue;
    final fromProfile = profileNameByUid[peerUid];
    if (fromProfile != null && fromProfile.isNotEmpty) {
      out[key] = fromProfile;
    }
  }
  return out;
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

/// Un message précis (ex. détails sondage hors fenêtre live).
final chatMessageProvider = StreamProvider.family<
    ChatMessage?,
    ({String clubId, String conversationId, String messageId})>((ref, key) {
  return ref.watch(chatServiceProvider).watchMessage(
        clubId: key.clubId,
        conversationId: key.conversationId,
        messageId: key.messageId,
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
