import 'package:viro_team_v2/services/analytics_service.dart';

/// Faux client PostHog : enregistre chaque appel pour les assertions.
class RecordingAnalyticsClient implements AnalyticsClient {
  final captures = <({String eventName, Map<String, Object>? properties})>[];
  final calls = <String>[];
  bool? setupOptOut;
  bool? enabled;
  ({
    String userId,
    Map<String, Object>? properties,
    Map<String, Object>? setOnce,
  })? identified;
  ({String groupType, String groupKey, Map<String, Object>? properties})?
      grouped;
  final registered = <String, Object>{};

  @override
  Future<void> setup({
    required String apiKey,
    required String host,
    required bool optOut,
  }) async {
    calls.add('setup');
    setupOptOut = optOut;
  }

  @override
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
  }) async {
    captures.add((eventName: eventName, properties: properties));
  }

  @override
  Future<void> setEnabled(bool enabled) async {
    calls.add('setEnabled');
    this.enabled = enabled;
  }

  @override
  Future<void> identify({
    required String userId,
    Map<String, Object>? userProperties,
    Map<String, Object>? userPropertiesSetOnce,
  }) async {
    calls.add('identify');
    identified = (
      userId: userId,
      properties: userProperties,
      setOnce: userPropertiesSetOnce,
    );
  }

  @override
  Future<void> group({
    required String groupType,
    required String groupKey,
    Map<String, Object>? groupProperties,
  }) async {
    calls.add('group');
    grouped = (
      groupType: groupType,
      groupKey: groupKey,
      properties: groupProperties,
    );
  }

  @override
  Future<void> register(String key, Object value) async {
    calls.add('register');
    registered[key] = value;
  }

  @override
  Future<void> reset() async {
    calls.add('reset');
    registered.clear();
  }
}
