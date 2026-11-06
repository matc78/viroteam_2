import 'package:viro_team_v2/features/chat/widgets/chat_thread/chat_thread_helpers.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Construit les maps nom / membre par uid (viewer inclus si résolu).
({
  Map<String, String> nameByUid,
  Map<String, ClubMember> memberByUid,
}) chatThreadMemberLookupMaps({
  required List<ClubMember> members,
  required String? viewerUid,
}) {
  final nameByUid = <String, String>{
    for (final member in members)
      if (member.accountUid != null)
        member.accountUid!:
            chatThreadReactorNameFor(member.accountUid!, members),
  };
  final memberByUid = <String, ClubMember>{
    for (final member in members)
      if (member.accountUid != null) member.accountUid!: member,
  };
  // Viewer sans fiche lisible (parent) : nom de repli quand même.
  final uid = viewerUid;
  if (uid != null && !nameByUid.containsKey(uid)) {
    nameByUid[uid] = chatThreadReactorNameFor(uid, members);
  }
  return (nameByUid: nameByUid, memberByUid: memberByUid);
}
