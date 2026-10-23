import 'package:viro_team_v2/config/project_config.dart';

/// Emplacement d'un lien store, lu par la Play Console (acquisition UTM) et
/// App Store Connect (liens de campagne). Mêmes valeurs que le portail
/// (`portal/src/lib/storeLinks.ts`).
enum StoreCampaign {
  inviteShare('invite_share');

  const StoreCampaign(this.key);

  final String key;
}

const String _storeLinkSource = 'app';

/// Lien Google Play avec `referrer` UTM (source `app` + [campaign]).
String playStoreLink(StoreCampaign campaign) {
  final referrer = 'utm_source=$_storeLinkSource&utm_campaign=${campaign.key}';
  return '${ProjectConfig.playStoreUrl}'
      '&referrer=${Uri.encodeComponent(referrer)}';
}

/// Lien App Store avec campagne `ct` (et `pt` si
/// [ProjectConfig.appStoreProviderToken] est renseigné).
String appStoreLink(StoreCampaign campaign) {
  final params = <String, String>{
    if (ProjectConfig.appStoreProviderToken.isNotEmpty)
      'pt': ProjectConfig.appStoreProviderToken,
    'ct': '${_storeLinkSource}_${campaign.key}',
    'mt': '8',
  };
  return Uri.parse(ProjectConfig.appStoreUrl)
      .replace(queryParameters: params)
      .toString();
}
