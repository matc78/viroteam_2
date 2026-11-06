import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Remplace le nom figé des cotisations par le nom courant de la fiche
/// `members/{memberId}` (clé unique, cf. `fee_seasons/*/member_fees/{memberId}`).
///
/// Garde [MemberFee.memberDisplayName] si la fiche est absente ou sans nom.
List<MemberFee> withCurrentMemberNames(
  List<MemberFee> fees,
  List<ClubMember> members,
) {
  if (members.isEmpty) return fees;
  final namesById = <String, String>{
    for (final member in members)
      if (member.fullName.trim().isNotEmpty)
        member.memberId: member.fullName.trim(),
  };
  return [
    for (final fee in fees)
      if (namesById[fee.memberId] case final name?
          when name != fee.memberDisplayName)
        fee.withMemberDisplayName(name)
      else
        fee,
  ];
}
