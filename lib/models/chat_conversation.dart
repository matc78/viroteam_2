import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Ton d’avatar icône (liste / AppBar / infos) — aligné sur le type.
///
/// La couleur UI se mappe côté widgets (`colorForConversationGroupAvatarTone`).
enum ConversationGroupAvatarTone {
  channel,
  team,
  parents,
  group,
}

/// Profil d’un participant dénormalisé sur la conversation (écrit par les Functions).
///
/// Seule source de noms / avatars / rôles pour un parent, qui ne peut pas lister
/// les fiches membres du club.
class ChatParticipantProfile {
  const ChatParticipantProfile({
    required this.role,
    this.firstName = '',
    this.lastName = '',
    this.displayName = '',
    this.avatarUrl,
  });

  final String firstName;
  final String lastName;
  final String displayName;
  final String? avatarUrl;

  /// `player` | `coach` | `admin` | `parent`.
  final String role;

  /// Parse une entrée de `participantProfiles` (valeurs non-string ignorées).
  factory ChatParticipantProfile.fromMap(Map<String, dynamic> data) {
    String text(String key) {
      final value = data[key];
      return value is String ? value.trim() : '';
    }

    final avatar = text(FirestoreFields.avatarUrl);
    return ChatParticipantProfile(
      firstName: text(FirestoreFields.firstName),
      lastName: text(FirestoreFields.lastName),
      displayName: text(FirestoreFields.displayName),
      avatarUrl: avatar.isEmpty ? null : avatar,
      role: text(FirestoreFields.role).isEmpty
          ? MemberRoles.player
          : text(FirestoreFields.role),
    );
  }
}

/// Conversation club (`clubs/{clubId}/conversations/{convId}`).
class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.clubId,
    required this.type,
    required this.title,
    required this.participantUids,
    required this.writePolicy,
    this.systemKey,
    this.teamId,
    this.categoryKey,
    this.titleOverride,
    this.avatarUrl,
    this.lastMessageAt,
    this.lastMessagePreview = '',
    this.lastSenderUid,
    this.lastSenderFirstName,
    this.lastSenderRole,
    this.createdAt,
    this.updatedAt,
    this.participantProfiles = const {},
  });

  final String id;
  final String clubId;
  final String type;
  final String title;
  final String? titleOverride;

  /// Photo de la discussion (groupes ouverts uniquement).
  final String? avatarUrl;
  final String? systemKey;
  final String? teamId;
  final String? categoryKey;
  final List<String> participantUids;
  final String writePolicy;
  final DateTime? lastMessageAt;
  final String lastMessagePreview;
  final String? lastSenderUid;
  final String? lastSenderFirstName;
  final String? lastSenderRole;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Profils des participants par uid (vide tant que la sync serveur n’est pas passée).
  final Map<String, ChatParticipantProfile> participantProfiles;

  /// Titre affiché (override si présent).
  ///
  /// Pour un DM 1:1, préférer [peerDisplayName] (nom de l’autre) pour éviter
  /// d’afficher le titre figé à la création (= nom de la cible).
  String displayTitle({String? peerDisplayName}) {
    final override = titleOverride?.trim();
    if (override != null && override.isNotEmpty) return override;
    final peer = peerDisplayName?.trim();
    if (peer != null && peer.isNotEmpty && !isGroup) return peer;
    return title;
  }

  /// UID de l’autre participant d’un DM 1:1 pour [viewerUid], sinon null.
  String? peerUidFor(String? viewerUid) {
    if (viewerUid == null || viewerUid.isEmpty || isGroup) return null;
    for (final uid in participantUids) {
      if (uid.isNotEmpty && uid != viewerUid) return uid;
    }
    return null;
  }

  bool get isReadonlyForMembers =>
      writePolicy == ChatWritePolicies.adminsOnly ||
      writePolicy == ChatWritePolicies.coachesAndAdmins;

  /// True si ce n’est pas un DM 1:1 (canaux / groupes).
  bool get isGroup {
    if (type == ChatConversationTypes.dm) {
      return participantUids.length > 2;
    }
    return true;
  }

  /// Groupe multi-users non-canal : les participants peuvent changer l’avatar.
  bool get canEditGroupAvatar => isGroup && !isReadonlyForMembers;

  /// Ton d’avatar pour un groupe / canal (pas un DM).
  ConversationGroupAvatarTone get groupAvatarTone {
    if (isReadonlyForMembers) return ConversationGroupAvatarTone.channel;
    if (type == ChatConversationTypes.team) {
      return ConversationGroupAvatarTone.team;
    }
    if (type == ChatConversationTypes.parents) {
      return ConversationGroupAvatarTone.parents;
    }
    return ConversationGroupAvatarTone.group;
  }

  /// Sondages autorisés uniquement si plus de 2 participants (règles Firestore).
  bool get allowsPolls => participantUids.length > 2;

  factory ChatConversation.fromFirestore({
    required String clubId,
    required DocumentSnapshot<Map<String, dynamic>> doc,
  }) {
    final data = doc.data() ?? {};
    return ChatConversation(
      id: doc.id,
      clubId: clubId,
      type: data[FirestoreFields.type] as String? ?? ChatConversationTypes.team,
      title: data[FirestoreFields.title] as String? ?? '',
      titleOverride: data[FirestoreFields.titleOverride] as String?,
      avatarUrl: data[FirestoreFields.avatarUrl] as String?,
      systemKey: data[FirestoreFields.systemKey] as String?,
      teamId: data[FirestoreFields.teamId] as String?,
      categoryKey: data[FirestoreFields.categoryKey] as String?,
      participantUids: _stringList(data[FirestoreFields.participantUids]),
      writePolicy:
          data[FirestoreFields.writePolicy] as String? ?? ChatWritePolicies.open,
      lastMessageAt: _asDateTime(data[FirestoreFields.lastMessageAt]),
      lastMessagePreview:
          data[FirestoreFields.lastMessagePreview] as String? ?? '',
      lastSenderUid: data[FirestoreFields.lastSenderUid] as String?,
      lastSenderFirstName: data[FirestoreFields.lastSenderFirstName] as String?,
      lastSenderRole: data[FirestoreFields.lastSenderRole] as String?,
      createdAt: _asDateTime(data[FirestoreFields.createdAt]),
      updatedAt: _asDateTime(data[FirestoreFields.updatedAt]),
      participantProfiles:
          _participantProfiles(data[FirestoreFields.participantProfiles]),
    );
  }
}

Map<String, ChatParticipantProfile> _participantProfiles(Object? raw) {
  if (raw is! Map) return const {};
  return {
    for (final entry in raw.entries)
      if (entry.key is String && entry.value is Map)
        entry.key as String: ChatParticipantProfile.fromMap(
          Map<String, dynamic>.from(entry.value as Map),
        ),
  };
}

List<String> _stringList(Object? raw) {
  if (raw is! List) return const [];
  return raw
      .whereType<String>()
      .where((id) => id.isNotEmpty)
      .toList(growable: false);
}

DateTime? _asDateTime(Object? raw) {
  if (raw is Timestamp) return raw.toDate();
  if (raw is DateTime) return raw;
  return null;
}
