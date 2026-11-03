import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_helpers.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';
import 'package:viro_team_v2/models/chat_message.dart';
import 'package:viro_team_v2/models/chat_user_state.dart';
import 'package:viro_team_v2/models/club_member.dart';

ChatConversation _conversationWith(String writePolicy) => ChatConversation(
      id: 'conv',
      clubId: 'club',
      type: ChatConversationTypes.category,
      title: 'Canal',
      participantUids: const ['coach', 'player'],
      writePolicy: writePolicy,
    );

ChatConversation _dm({
  DateTime? lastMessageAt,
  String? lastSenderUid,
}) =>
    ChatConversation(
      id: 'dm',
      clubId: 'club',
      type: ChatConversationTypes.dm,
      title: 'Titre figé',
      participantUids: const ['me', 'peer'],
      writePolicy: ChatWritePolicies.open,
      lastMessageAt: lastMessageAt,
      lastSenderUid: lastSenderUid,
    );

final _t0 = DateTime(2026, 11, 3, 10);

ChatMessage _message(
  String id, {
  int minutes = 0,
  String sender = 'peer',
  String type = ChatMessageTypes.text,
  String? text,
}) =>
    ChatMessage(
      id: id,
      conversationId: 'dm',
      clubId: 'club',
      type: type,
      senderUid: sender,
      createdAt: _t0.add(Duration(minutes: minutes)),
      text: text,
    );

void main() {
  group('chatThreadReadonlyHint', () {
    test('annonce les admins seuls sur un canal admins_only', () {
      expect(
        chatThreadReadonlyHint(_conversationWith(ChatWritePolicies.adminsOnly)),
        AppCopy.chat.readonlyHint,
      );
    });

    test('annonce coachs et admins sur un canal coaches_and_admins', () {
      expect(
        chatThreadReadonlyHint(
          _conversationWith(ChatWritePolicies.coachesAndAdmins),
        ),
        AppCopy.chat.readonlyHintCoachesAndAdmins,
      );
    });

    test('rien pour une conversation ouverte ou absente', () {
      expect(
        chatThreadReadonlyHint(_conversationWith(ChatWritePolicies.open)),
        isNull,
      );
      expect(chatThreadReadonlyHint(null), isNull);
    });
  });

  group('chatThreadCanWrite', () {
    final channel = _conversationWith(ChatWritePolicies.coachesAndAdmins);

    test('un coach écrit dans un canal coaches_and_admins', () {
      expect(chatThreadCanWrite(channel, 'coach', MemberRoles.coach), isTrue);
    });

    test('un joueur ne peut pas y écrire', () {
      expect(chatThreadCanWrite(channel, 'player', MemberRoles.player), isFalse);
    });

    test('seul un admin écrit dans un canal admins_only', () {
      final adminsOnly = _conversationWith(ChatWritePolicies.adminsOnly);
      expect(chatThreadCanWrite(adminsOnly, 'coach', MemberRoles.admin), isTrue);
      expect(chatThreadCanWrite(adminsOnly, 'coach', MemberRoles.coach), isFalse);
    });

    test('un non-participant ou un anonyme ne peut pas écrire', () {
      final open = _conversationWith(ChatWritePolicies.open);
      expect(chatThreadCanWrite(open, 'stranger', MemberRoles.admin), isFalse);
      expect(chatThreadCanWrite(open, null, MemberRoles.admin), isFalse);
      expect(chatThreadCanWrite(null, 'coach', MemberRoles.admin), isFalse);
    });
  });

  group('chatThreadReplyPreviewText', () {
    test('photo, sondage, supprimé et texte', () {
      expect(
        chatThreadReplyPreviewText(
          _message('a', type: ChatMessageTypes.image),
        ),
        AppCopy.chat.photoPreview,
      );
      expect(
        chatThreadReplyPreviewText(
          ChatMessage(
            id: 'p',
            conversationId: 'dm',
            clubId: 'club',
            type: ChatMessageTypes.poll,
            senderUid: 'peer',
            createdAt: _t0,
            pollQuestion: '  On joue samedi ?  ',
          ),
        ),
        'On joue samedi ?',
      );
      expect(
        chatThreadReplyPreviewText(
          ChatMessage(
            id: 'd',
            conversationId: 'dm',
            clubId: 'club',
            type: ChatMessageTypes.text,
            senderUid: 'peer',
            createdAt: _t0,
            text: 'Oups',
            deletedAt: _t0,
          ),
        ),
        AppCopy.chat.messageDeleted,
      );
      expect(chatThreadReplyPreviewText(_message('t', text: ' Salut ')), 'Salut');
    });
  });

  group('chatThreadEffectiveUnread', () {
    test('compteur Firestore prioritaire, zéro si en sourdine', () {
      expect(
        chatThreadEffectiveUnread(
          conversation: _dm(),
          state: const ChatUserState(id: 's', unreadCount: 3),
          viewerUid: 'me',
        ),
        3,
      );
      expect(
        chatThreadEffectiveUnread(
          conversation: _dm(),
          state: const ChatUserState(id: 's', unreadCount: 3, muted: true),
          viewerUid: 'me',
        ),
        0,
      );
    });

    test('fallback : dernier message d’un autre après lastReadAt', () {
      final conversation = _dm(lastMessageAt: _t0, lastSenderUid: 'peer');
      expect(
        chatThreadEffectiveUnread(
          conversation: conversation,
          state: null,
          viewerUid: 'me',
        ),
        1,
      );
      expect(
        chatThreadEffectiveUnread(
          conversation: conversation,
          state: ChatUserState(id: 's', lastReadAt: _t0.add(_minute)),
          viewerUid: 'me',
        ),
        0,
      );
      expect(
        chatThreadEffectiveUnread(
          conversation: _dm(lastMessageAt: _t0, lastSenderUid: 'me'),
          state: null,
          viewerUid: 'me',
        ),
        0,
      );
    });
  });

  group('chatThreadUnreadSeparator', () {
    test('compteur Firestore quand il y en a un', () {
      final separator = chatThreadUnreadSeparator(
        conversation: _dm(),
        state: const ChatUserState(id: 's', unreadCount: 2),
        viewerUid: 'me',
      );
      expect(separator.count, 2);
      expect(separator.after, isNull);
    });

    test('lastReadAt quand le compteur est à zéro', () {
      final separator = chatThreadUnreadSeparator(
        conversation: _dm(lastMessageAt: _t0, lastSenderUid: 'peer'),
        state: ChatUserState(id: 's', lastReadAt: _t0.subtract(_minute)),
        viewerUid: 'me',
      );
      expect(separator.count, isNull);
      expect(separator.after, _t0.subtract(_minute));
    });

    test('compteur effectif si jamais lu, rien si tout est lu', () {
      expect(
        chatThreadUnreadSeparator(
          conversation: _dm(lastMessageAt: _t0, lastSenderUid: 'peer'),
          state: null,
          viewerUid: 'me',
        ).count,
        1,
      );
      final none = chatThreadUnreadSeparator(
        conversation: _dm(),
        state: null,
        viewerUid: 'me',
      );
      expect(none.count, isNull);
      expect(none.after, isNull);
    });
  });

  group('chatThreadFirstUnreadIndex', () {
    final messages = [
      _message('a', minutes: 0),
      _message('b', minutes: 1, sender: 'me'),
      _message('c', minutes: 2),
      _message('d', minutes: 3, sender: 'me'),
      _message('e', minutes: 4),
    ];

    test('par compteur : saute mes propres messages', () {
      expect(
        chatThreadFirstUnreadIndex(
          messages: messages,
          viewerUid: 'me',
          separator: (count: 2, after: null),
        ),
        4,
      );
      expect(
        chatThreadFirstUnreadIndex(
          messages: messages,
          viewerUid: 'me',
          separator: (count: 4, after: null),
        ),
        2,
      );
    });

    test('compteur plus grand que la liste : borné au début', () {
      expect(
        chatThreadFirstUnreadIndex(
          messages: messages,
          viewerUid: 'me',
          separator: (count: 99, after: null),
        ),
        0,
      );
    });

    test('par date : premier message d’un autre après la date', () {
      expect(
        chatThreadFirstUnreadIndex(
          messages: messages,
          viewerUid: 'me',
          separator: (count: null, after: _t0.add(_minute)),
        ),
        2,
      );
    });

    test('pas de séparateur ou liste vide', () {
      expect(
        chatThreadFirstUnreadIndex(
          messages: messages,
          viewerUid: 'me',
          separator: (count: null, after: null),
        ),
        isNull,
      );
      expect(
        chatThreadFirstUnreadIndex(
          messages: const [],
          viewerUid: 'me',
          separator: (count: 3, after: null),
        ),
        isNull,
      );
    });
  });

  group('mergeChatThreadMessages', () {
    test('trie par date, le live remplace l’historique', () {
      final merged = mergeChatThreadMessages(
        older: [_message('a', minutes: 0, text: 'ancien'), _message('b')],
        live: [
          _message('c', minutes: 2),
          _message('a', minutes: 0, text: 'live'),
        ],
        pending: const [],
      );
      expect(merged.map((m) => m.id), ['a', 'b', 'c']);
      expect(merged.first.text, 'live');
    });

    test('un optimiste disparaît dès que son id arrive en live', () {
      final pending = _message('p', minutes: 5, sender: 'me').copyWith(
        localStatus: ChatMessageLocalStatus.sending,
      );
      final beforeAck = mergeChatThreadMessages(
        older: const [],
        live: [_message('a')],
        pending: [pending],
      );
      expect(beforeAck.last.isSending, isTrue);

      final afterAck = mergeChatThreadMessages(
        older: const [],
        live: [_message('a'), _message('p', minutes: 5, sender: 'me')],
        pending: [pending],
      );
      expect(afterAck.map((m) => m.id), ['a', 'p']);
      expect(afterAck.last.isLocalPending, isFalse);
    });
  });

  group('chatThreadMessagesLeavingLiveWindow', () {
    List<ChatMessage> window(int from, int to) => [
          for (var i = from; i < to; i++) _message('m$i', minutes: i),
        ];

    test('garde les messages poussés hors d’une fenêtre pleine', () {
      final dropped = chatThreadMessagesLeavingLiveWindow(
        previous: window(0, 3),
        next: window(1, 4),
        older: const [],
        pageSize: 3,
      );
      expect(dropped.map((m) => m.id), ['m0']);
    });

    test('ignore une fenêtre non pleine (purge) et les déjà connus', () {
      expect(
        chatThreadMessagesLeavingLiveWindow(
          previous: window(0, 3),
          next: window(1, 3),
          older: const [],
          pageSize: 3,
        ),
        isEmpty,
      );
      expect(
        chatThreadMessagesLeavingLiveWindow(
          previous: window(0, 3),
          next: window(1, 4),
          older: [_message('m0')],
          pageSize: 3,
        ),
        isEmpty,
      );
      expect(
        chatThreadMessagesLeavingLiveWindow(
          previous: null,
          next: window(1, 4),
          older: const [],
          pageSize: 3,
        ),
        isEmpty,
      );
    });
  });

  group('chatThreadPendingMessage', () {
    test('texte en envoi avec l’extrait de la réponse', () {
      final reply = _message('r', text: '  On se retrouve à 18h  ');
      final pending = chatThreadPendingMessage(
        id: 'p',
        clubId: 'club',
        conversationId: 'dm',
        senderUid: 'me',
        createdAt: _t0,
        text: 'Ça marche',
        replyTo: reply,
      );
      expect(pending.type, ChatMessageTypes.text);
      expect(pending.text, 'Ça marche');
      expect(pending.isSending, isTrue);
      expect(pending.replyToMessageId, 'r');
      expect(pending.replyToText, 'On se retrouve à 18h');
      expect(pending.replyToSenderUid, 'peer');
    });

    test('photo : type image et octets locaux', () {
      final bytes = Uint8List.fromList([1, 2, 3]);
      final pending = chatThreadPendingMessage(
        id: 'p',
        clubId: 'club',
        conversationId: 'dm',
        senderUid: 'me',
        createdAt: _t0,
        imageBytes: bytes,
      );
      expect(pending.type, ChatMessageTypes.image);
      expect(pending.localImageBytes, bytes);
      expect(pending.hasReply, isFalse);
    });
  });

  group('chatThreadDmPeer', () {
    const peerMember = ClubMember(
      memberId: 'm-peer',
      role: MemberRoles.coach,
      status: 'active',
      accountUid: 'peer',
      displayName: 'Sam Martin',
      avatarUrl: 'https://exemple.test/sam.png',
    );

    test('annuaire inbox prioritaire', () {
      final peer = chatThreadDmPeer(
        conversation: _dm(),
        viewerUid: 'me',
        members: const [peerMember],
        inboxPeer: (displayName: 'Sam (inbox)', avatarUrl: null),
        seedAvatarUrl: 'https://exemple.test/seed.png',
      );
      expect(peer.displayName, 'Sam (inbox)');
      expect(peer.avatarUrl, 'https://exemple.test/seed.png');
    });

    test('sinon fiche membre du pair', () {
      final peer = chatThreadDmPeer(
        conversation: _dm(),
        viewerUid: 'me',
        members: const [peerMember],
      );
      expect(peer.displayName, 'Sam Martin');
      expect(peer.avatarUrl, 'https://exemple.test/sam.png');
    });

    test('la photo passée à l’open l’emporte sur la fiche', () {
      final peer = chatThreadDmPeer(
        conversation: _dm(),
        viewerUid: 'me',
        members: const [peerMember],
        seedAvatarUrl: 'https://exemple.test/seed.png',
      );
      expect(peer.displayName, 'Sam Martin');
      expect(peer.avatarUrl, 'https://exemple.test/seed.png');
    });

    test('rien pour un groupe', () {
      final group = ChatConversation(
        id: 'g',
        clubId: 'club',
        type: ChatConversationTypes.team,
        title: 'U11',
        participantUids: const ['me', 'peer', 'other'],
        writePolicy: ChatWritePolicies.open,
      );
      final peer = chatThreadDmPeer(
        conversation: group,
        viewerUid: 'me',
        members: const [peerMember],
      );
      expect(peer.displayName, isNull);
      expect(peer.avatarUrl, isNull);
    });
  });
}

const _minute = Duration(minutes: 1);
