import 'dart:convert';

import 'package:http/http.dart' as http;

/// Suggestion d'adresse française (API Adresse data.gouv.fr).
class FrenchAddressSuggestion {
  const FrenchAddressSuggestion({
    required this.label,
    required this.city,
    required this.postalCode,
    required this.street,
  });

  final String label;
  final String city;
  final String postalCode;
  final String street;
}

/// Autocomplete adresses via l'API publique Adresse (France).
class FrenchAddressService {
  FrenchAddressService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// Recherche des adresses correspondant à [query] (min. 3 caractères).
  Future<List<FrenchAddressSuggestion>> search(String query) async {
    final trimmed = query.trim();
    if (trimmed.length < 3) return [];

    final uri = Uri.https('api-adresse.data.gouv.fr', '/search/', {
      'q': trimmed,
      'limit': '6',
    });

    try {
      final response = await _client.get(uri);
      if (response.statusCode != 200) return [];

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final features = body['features'] as List<dynamic>? ?? [];

      return features.whereType<Map<String, dynamic>>().map((feature) {
        final properties =
            feature['properties'] as Map<String, dynamic>? ?? {};
        final city = properties['city'] as String? ?? '';
        final postalCode = properties['postcode'] as String? ?? '';
        final street = properties['name'] as String? ?? '';
        final label = properties['label'] as String? ?? street;

        return FrenchAddressSuggestion(
          label: label,
          city: city,
          postalCode: postalCode,
          street: street,
        );
      }).toList();
    } catch (_) {
      return [];
    }
  }

  /// Libère le client HTTP.
  void dispose() {
    _client.close();
  }
}
