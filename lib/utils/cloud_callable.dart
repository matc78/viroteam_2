import 'package:viro_team_v2/config/project_config.dart';

/// Nom de Cloud Function callable selon la base Firestore active.
///
/// Prod (`v2-prod`) → `name`.
/// Dev (`v2-dev`) → `nameDev`.
String cloudCallableName(String name) =>
    ProjectConfig.firestoreDatabaseId == ProjectConfig.firestoreProdDatabaseId
        ? name
        : '${name}Dev';
