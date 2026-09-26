import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/chat_messages_local_cache.dart';

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

/// Infos des pairs DM pour le viewer : `clubId|convId` → (displayName, avatarUrl?).
///
/// Le `title` Firestore est figé au nom de la cible à la création ; sans
/// résolution côté viewer, le destinataire voit son propre nom.
final chatDmPeersProvider = FutureProvider<
    Map<String, ({String displayName, String? avatarUrl})>>((ref) async {
  final uid = _uidOf(ref);
  if (uid == null || uid.isEmpty) return const {};
  final conversations = ref.watch(chatInboxProvider).value ?? const [];
  if (conversations.isEmpty) return const {};

  final memberService = ref.read(memberServiceProvider);
  final userService = ref.read(userServiceProvider);
  final metaByClubUid = <String, ({String displayName, String? avatarUrl})>{};

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
          final photo = member.avatarUrl?.trim();
          metaByClubUid['$clubId|$accountUid'] = (
            displayName: name,
            avatarUrl: (photo != null && photo.isNotEmpty) ? photo : null,
          );
        }
      } catch (_) {
        // Best-effort.
      }
    }),
  );

  final out = <String, ({String displayName, String? avatarUrl})>{};
  final missingUids = <String>{};
  final missingAvatarUids = <String>{};
  for (final conversation in conversations) {
    final peerUid = conversation.peerUidFor(uid);
    if (peerUid == null) continue;
    final fromMember = metaByClubUid['${conversation.clubId}|$peerUid'];
    if (fromMember != null) {
      out['${conversation.clubId}|${conversation.id}'] = fromMember;
      if (fromMember.avatarUrl == null) missingAvatarUids.add(peerUid);
    } else {
      missingUids.add(peerUid);
    }
  }

  final profileByUid = <String, ({String displayName, String? avatarUrl})>{};
  final uidsToFetch = {...missingUids, ...missingAvatarUids};
  await Future.wait(
    uidsToFetch.map((peerUid) async {
      try {
        final user = await userService.getUser(peerUid);
        if (user == null) return;
        final name = user.displayName.trim().isNotEmpty
            ? user.displayName.trim()
            : [user.firstName, user.lastName]
                .where((part) => part.trim().isNotEmpty)
                .join(' ')
                .trim();
        final photo = user.avatarUrl?.trim();
        profileByUid[peerUid] = (
          displayName: name,
          avatarUrl: (photo != null && photo.isNotEmpty) ? photo : null,
        );
      } catch (_) {
        // Best-effort.
      }
    }),
  );

  for (final conversation in conversations) {
    final key = '${conversation.clubId}|${conversation.id}';
    final peerUid = conversation.peerUidFor(uid);
    if (peerUid == null) continue;
    final fromProfile = profileByUid[peerUid];
    if (fromProfile == null) continue;
    final existing = out[key];
    if (existing == null) {
      if (fromProfile.displayName.isNotEmpty) {
        out[key] = fromProfile;
      }
      continue;
    }
    if (existing.avatarUrl == null && fromProfile.avatarUrl != null) {
      out[key] = (
        displayName: existing.displayName,
        avatarUrl: fromProfile.avatarUrl,
      );
    }
  }
  return out;
});

/// Noms des pairs DM (`clubId|convId` → displayName) — dérivé de [chatDmPeersProvider].
final chatDmPeerTitlesProvider = Provider<Map<String, String>>((ref) {
  final peers = ref.watch(chatDmPeersProvider).value ?? const {};
  return {
    for (final entry in peers.entries) entry.key: entry.value.displayName,
  };
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

/// Messages d’un thread — cache disque d’abord, puis stream Firestore.
final chatMessagesProvider = StreamProvider.family<
    List<ChatMessage>,
    ({String clubId, String conversationId})>((ref, key) {
  // Garde le hot cache en mémoire pendant la session (réopen instantanée).
  ref.keepAlive();
  final cache = ref.watch(chatMessagesLocalCacheProvider);
  final live = ref.watch(chatServiceProvider).watchMessages(
        clubId: key.clubId,
        conversationId: key.conversationId,
      );
  return _messagesCacheFirst(
    cache: cache,
    clubId: key.clubId,
    conversationId: key.conversationId,
    live: live,
  );
});

/// Émet le cache local puis chaque snapshot live (et réécrit le cache).
Stream<List<ChatMessage>> _messagesCacheFirst({
  required ChatMessagesLocalCache cache,
  required String clubId,
  required String conversationId,
  required Stream<List<ChatMessage>> live,
}) async* {
  final cached = await cache.read(
    clubId: clubId,
    conversationId: conversationId,
  );
  if (cached != null && cached.isNotEmpty) {
    yield cached;
  }
  await for (final messages in live) {
    yield messages;
    unawaited(
      cache.write(
        clubId: clubId,
        conversationId: conversationId,
        messages: messages,
      ),
    );
  }
}

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
  ref.keepAlive();
  return ref.watch(chatServiceProvider).watchConversation(
        clubId: key.clubId,
        conversationId: key.conversationId,
      );
});
