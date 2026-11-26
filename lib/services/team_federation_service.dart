import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Bilan d'une synchro fédé (liaison ou actualisation).
class FederationSyncResult {
  const FederationSyncResult({required this.created, required this.updated});

  final int created;
  final int updated;
}

/// Lien d'une équipe vers sa poule fédérale (FFVB) : liaison, actualisation
/// et lecture du classement / des matchs de la poule.
///
/// Toute écriture passe par les callables (`previewFederationLink`,
/// `linkTeamFederation`, `unlinkTeamFederation`, `refreshTeamFederation`).
class TeamFederationService {
  TeamFederationService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  }) : _db = firestore ?? appFirestore,
       _functions =
           functions ?? FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> _federation(
    String clubId,
    String teamId,
  ) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.teamsSubcollection)
      .doc(teamId)
      .collection(ProjectConfig.teamFederationSubcollection);

  Future<Map<dynamic, dynamic>> _call(
    String name,
    Map<String, dynamic> payload,
  ) async {
    final result = await _functions
        .httpsCallable(cloudCallableName(name))
        .call<dynamic>(payload);
    final data = result.data;
    return data is Map ? data : const {};
  }

  FederationSyncResult _syncResult(Map<dynamic, dynamic> data) =>
      FederationSyncResult(
        created: (data['created'] as num?)?.toInt() ?? 0,
        updated: (data['updated'] as num?)?.toInt() ?? 0,
      );

  /// Vérifie [url] et retourne la poule et ses équipes (rien n'est écrit).
  Future<FederationLinkPreview> previewLink({
    required String clubId,
    required String teamId,
    required String url,
  }) async {
    final data = await _call('previewFederationLink', {
      FirestoreFields.clubId: clubId,
      FirestoreFields.teamId: teamId,
      FirestoreFields.url: url.trim(),
    });
    final teams = (data['teams'] as List<dynamic>? ?? const [])
        .whereType<Map<dynamic, dynamic>>()
        .map(
          (team) => FederationPoolTeam(
            key: team[FirestoreFields.key] as String? ?? '',
            name: team[FirestoreFields.name] as String? ?? '',
          ),
        )
        .where((team) => team.key.isNotEmpty)
        .toList();
    return FederationLinkPreview(
      poolLabel: data[FirestoreFields.poolLabel] as String? ?? '',
      teams: teams,
    );
  }

  /// Lie l'équipe à la poule de [url] (équipe [teamKey]) et importe la
  /// saison sans notification. [excludedMemberIds] : joueurs du roster non
  /// convoqués par défaut sur les matchs importés.
  Future<FederationSyncResult> link({
    required String clubId,
    required String teamId,
    required String url,
    required String teamKey,
    List<String> excludedMemberIds = const [],
  }) async {
    final data = await _call('linkTeamFederation', {
      FirestoreFields.clubId: clubId,
      FirestoreFields.teamId: teamId,
      FirestoreFields.url: url.trim(),
      FirestoreFields.teamKey: teamKey,
      FirestoreFields.excludedMemberIds: excludedMemberIds,
    });
    return _syncResult(data);
  }

  /// Actualise maintenant (les changements sont notifiés à l'équipe).
  Future<FederationSyncResult> refresh({
    required String clubId,
    required String teamId,
  }) async {
    final data = await _call('refreshTeamFederation', {
      FirestoreFields.clubId: clubId,
      FirestoreFields.teamId: teamId,
    });
    return _syncResult(data);
  }

  /// Délie l'équipe. Avec [deleteImportedMatches], supprime aussi les
  /// matchs importés (lien erroné) ; retourne le nombre de matchs supprimés.
  Future<int> unlink({
    required String clubId,
    required String teamId,
    bool deleteImportedMatches = false,
  }) async {
    final data = await _call('unlinkTeamFederation', {
      FirestoreFields.clubId: clubId,
      FirestoreFields.teamId: teamId,
      FirestoreFields.deleteImportedMatches: deleteImportedMatches,
    });
    return (data[FirestoreFields.deletedMatches] as num?)?.toInt() ?? 0;
  }

  /// Classement de la poule de l'équipe, `null` tant qu'il n'existe pas.
  Stream<PoolStandings?> watchStandings({
    required String clubId,
    required String teamId,
  }) => _federation(clubId, teamId)
      .doc(ProjectConfig.federationStandingsDoc)
      .snapshots()
      .map((snap) => PoolStandings.fromMap(snap.data()));

  /// Tous les matchs de la poule (pour le parcours de chaque équipe).
  Stream<List<PoolMatch>> watchPoolMatches({
    required String clubId,
    required String teamId,
  }) => _federation(clubId, teamId)
      .doc(ProjectConfig.federationMatchesDoc)
      .snapshots()
      .map((snap) => PoolMatch.listFromMap(snap.data()));
}
