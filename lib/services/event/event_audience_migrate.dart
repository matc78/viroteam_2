import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Remplace [legacyId] par [canonicalId] dans [teamMemberIds] (dédupliqué).
///
/// Retourne `null` si aucun changement.
List<String>? migrateTeamMemberIds(
  List<String> teamMemberIds,
  String legacyId,
  String canonicalId,
) {
  if (legacyId.isEmpty ||
      canonicalId.isEmpty ||
      legacyId == canonicalId ||
      !teamMemberIds.contains(legacyId)) {
    return null;
  }
  final next = teamMemberIds
      .map((id) => id == legacyId ? canonicalId : id)
      .toSet()
      .toList();
  if (next.length == teamMemberIds.length &&
      List.generate(next.length, (i) => next[i] == teamMemberIds[i])
          .every((same) => same)) {
    return null;
  }
  return next;
}

/// Plan de migration RSVP (sans FieldValue).
typedef RsvpMigrationPlan = ({bool setCanonical, Object? legacyValue});

/// Calcule comment migrer la map RSVP (pur).
RsvpMigrationPlan? planRsvpMigration(
  Map<String, dynamic>? rsvp,
  String legacyId,
  String canonicalId,
) {
  if (rsvp == null ||
      legacyId.isEmpty ||
      canonicalId.isEmpty ||
      legacyId == canonicalId ||
      !rsvp.containsKey(legacyId)) {
    return null;
  }
  final legacyValue = rsvp[legacyId];
  final canonicalRaw = rsvp[canonicalId];
  final hasCanonical = canonicalRaw != null &&
      canonicalRaw.toString().trim().isNotEmpty;
  return (
    setCanonical: !hasCanonical && legacyValue != null,
    legacyValue: legacyValue,
  );
}

/// Construit le patch Firestore pour migrer l’audience d’un event.
///
/// Retourne `null` si rien à changer.
Map<String, dynamic>? buildEventAudienceMigrationPatch({
  required List<String> teamMemberIds,
  required Map<String, dynamic>? rsvp,
  required String legacyId,
  required String canonicalId,
}) {
  final nextMembers =
      migrateTeamMemberIds(teamMemberIds, legacyId, canonicalId);
  final rsvpPlan = planRsvpMigration(rsvp, legacyId, canonicalId);
  if (nextMembers == null && rsvpPlan == null) return null;

  final patch = <String, dynamic>{};
  if (nextMembers != null) {
    patch[FirestoreFields.teamMemberIds] = nextMembers;
  }
  if (rsvpPlan != null) {
    patch['${FirestoreFields.rsvp}.$legacyId'] = FieldValue.delete();
    if (rsvpPlan.setCanonical) {
      patch['${FirestoreFields.rsvp}.$canonicalId'] = rsvpPlan.legacyValue;
    }
  }
  return patch;
}
