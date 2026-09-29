import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/person_data_format.dart';

/// Operations compte / role / licence pour les membres.
class MemberAccountOperations {
  /// Cree le module de mutations compte membre.
  MemberAccountOperations({
    required FirebaseFirestore firestore,
    required FirebaseFunctions functions,
  }) : _db = firestore,
       _functions = functions;

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> _members(String clubId) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.membersSubcollection);

  /// Change le role d'un membre via la callable `setMemberRole`.
  Future<void> updateMemberRole({
    required String clubId,
    required String memberId,
    required String newRole,
  }) async {
    if (!MemberRoleHierarchy.isAdmin(newRole) &&
        newRole != MemberRoles.coach &&
        newRole != MemberRoles.player) {
      throw ArgumentError('Rôle invalide.');
    }

    final callable =
        _functions.httpsCallable(cloudCallableName('setMemberRole'));
    await callable.call(<String, dynamic>{
      FirestoreFields.clubId: clubId,
      FirestoreFields.memberId: memberId,
      FirestoreFields.role: newRole,
    });
  }

  /// Retire un membre du club via la callable `removeMember`.
  Future<void> removeMember({
    required String clubId,
    required String memberId,
  }) async {
    final callable = _functions.httpsCallable(cloudCallableName('removeMember'));
    await callable.call(<String, dynamic>{
      FirestoreFields.clubId: clubId,
      FirestoreFields.memberId: memberId,
    });
  }

  /// Numero de licence (`playerInfo.license`) d'une fiche membre.
  Future<String> getMemberLicense({
    required String clubId,
    required String memberId,
  }) async {
    final memberSnap = await _members(clubId).doc(memberId).get();
    if (!memberSnap.exists) return '';
    final data = memberSnap.data() ?? {};
    final playerInfo =
        data[FirestoreFields.playerInfo] as Map<String, dynamic>?;
    if (playerInfo == null) return '';
    return (playerInfo[FirestoreFields.license] as String?)?.trim() ?? '';
  }

  /// Met a jour le numero de licence (`playerInfo.license`) d'un membre.
  ///
  /// [rawLicense] est optionnelle : vide pour effacer la licence.
  /// Cree `playerInfo` s'il est absent (ex. fiche coach).
  Future<void> updateMemberLicense({
    required String clubId,
    required String memberId,
    required String rawLicense,
  }) async {
    final formattedLicense = formatLicense(rawLicense);
    final memberRef = _members(clubId).doc(memberId);
    final memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      throw StateError(AppCopy.members.memberNotFound);
    }

    final data = memberSnap.data() ?? {};
    final existingInfo =
        data[FirestoreFields.playerInfo] is Map<String, dynamic>
            ? Map<String, dynamic>.from(
                data[FirestoreFields.playerInfo] as Map<String, dynamic>,
              )
            : <String, dynamic>{};

    await memberRef.update({
      FirestoreFields.playerInfo: {
        ...existingInfo,
        FirestoreFields.license: formattedLicense,
      },
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
