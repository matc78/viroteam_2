import 'package:url_launcher/url_launcher.dart';

/// Applications de navigation supportées pour ouvrir une adresse.
enum MapsApp {
  googleMaps,
  waze,
  appleMaps,
}

/// Construit l’URL de recherche / navigation pour [app] et [address].
Uri mapsSearchUri(MapsApp app, String address) {
  final query = Uri.encodeComponent(address.trim());
  return switch (app) {
    MapsApp.googleMaps => Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=$query',
      ),
    MapsApp.waze => Uri.parse(
        'https://waze.com/ul?q=$query&navigate=yes',
      ),
    MapsApp.appleMaps => Uri.parse(
        'https://maps.apple.com/?q=$query',
      ),
  };
}

/// Ouvre [address] dans l’application de navigation [app].
///
/// Retourne `true` si le lancement a réussi.
Future<bool> openAddressInMaps(MapsApp app, String address) {
  final trimmed = address.trim();
  if (trimmed.isEmpty) return Future.value(false);
  return launchUrl(
    mapsSearchUri(app, trimmed),
    mode: LaunchMode.externalApplication,
  );
}
