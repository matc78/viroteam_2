import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:viro_team_v2/config/project_config.dart';

/// Suggestion d'adresse française (BAN pour villes, Places pour adresses).
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

  /// Rue, numéro, ou nom du lieu.
  final String street;
}

/// Autocomplete : communes via Géoplateforme (BAN), adresses via Google Places.
class FrenchAddressService {
  FrenchAddressService({http.Client? client}) : _client = client ?? http.Client();

  static const _geopfHost = 'data.geopf.fr';
  static const _geopfSearchPath = '/geocodage/search';
  static const _placesHost = 'places.googleapis.com';
  static const _placesPath = '/v1/places:autocomplete';
  static const _maxSuggestions = 8;

  /// Clé Places (New) — `--dart-define=GOOGLE_PLACES_API_KEY=...`
  ///
  /// Si vide, l’app utilise le proxy portail `/api/club-setup/places`.
  static const _placesApiKey = String.fromEnvironment('GOOGLE_PLACES_API_KEY');

  static const _placesFieldMask =
      'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat';

  final http.Client _client;

  /// Recherche des communes correspondant à [query] (min. 3 caractères).
  Future<List<FrenchAddressSuggestion>> searchCities(String query) {
    return _searchGeoPfAddresses(
      query,
      type: 'municipality',
      labelBuilder: (city, postalCode, _) {
        if (city.isEmpty) return '';
        if (postalCode.isEmpty) return city;
        return '$city ($postalCode)';
      },
    );
  }

  /// Recherche d’adresses via Google Places dans [city].
  Future<List<FrenchAddressSuggestion>> searchStreets(
    String query, {
    required String city,
    String postalCode = '',
  }) async {
    final cityName = city.trim();
    final trimmed = query.trim();
    if (cityName.isEmpty || trimmed.length < 3) return [];

    if (_placesApiKey.isNotEmpty) {
      return _searchPlacesDirect(
        query: trimmed,
        city: cityName,
        postalCode: postalCode.trim(),
        apiKey: _placesApiKey,
      );
    }

    return _searchPlacesViaPortal(
      query: trimmed,
      city: cityName,
      postalCode: postalCode.trim(),
    );
  }

  Future<List<FrenchAddressSuggestion>> _searchPlacesViaPortal({
    required String query,
    required String city,
    required String postalCode,
  }) async {
    final params = <String, String>{
      'q': query,
      'city': city,
    };
    if (postalCode.isNotEmpty) params['postalCode'] = postalCode;

    final uri = Uri.parse(
      '${ProjectConfig.portalBaseUrl}/api/club-setup/places',
    ).replace(queryParameters: params);

    try {
      final response = await _client.get(uri);
      if (response.statusCode != 200) return [];

      final body = jsonDecode(response.body);
      if (body is! Map<String, dynamic>) return [];
      final raw = body['suggestions'];
      if (raw is! List) return [];

      final suggestions = <FrenchAddressSuggestion>[];
      for (final item in raw.whereType<Map>()) {
        final map = Map<String, dynamic>.from(item);
        final street = _firstString(map['street']);
        final label = _firstString(map['label']);
        if (street.isEmpty && label.isEmpty) continue;
        suggestions.add(
          FrenchAddressSuggestion(
            label: label.isNotEmpty ? label : street,
            city: _firstString(map['city']).isNotEmpty
                ? _firstString(map['city'])
                : city,
            postalCode: _firstString(map['postalCode']).isNotEmpty
                ? _firstString(map['postalCode'])
                : postalCode,
            street: street.isNotEmpty ? street : label,
          ),
        );
      }
      return _uniqueByLabel(suggestions, maxCount: _maxSuggestions);
    } catch (_) {
      return [];
    }
  }

  Future<List<FrenchAddressSuggestion>> _searchPlacesDirect({
    required String query,
    required String city,
    required String postalCode,
    required String apiKey,
  }) async {
    final inputParts = [query, postalCode, city]
        .where((part) => part.isNotEmpty)
        .toList();
    final uri = Uri.https(_placesHost, _placesPath);

    try {
      final response = await _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': _placesFieldMask,
        },
        body: jsonEncode({
          'input': inputParts.join(' '),
          'languageCode': 'fr',
          'includedRegionCodes': ['fr'],
          'includeQueryPredictions': false,
        }),
      );
      if (response.statusCode != 200) return [];

      final body = jsonDecode(response.body);
      if (body is! Map<String, dynamic>) return [];
      return _mapPlacesSuggestions(
        body['suggestions'],
        fallbackCity: city,
        fallbackPostal: postalCode,
      );
    } catch (_) {
      return [];
    }
  }

  List<FrenchAddressSuggestion> _mapPlacesSuggestions(
    dynamic raw, {
    required String fallbackCity,
    required String fallbackPostal,
  }) {
    if (raw is! List) return [];
    final suggestions = <FrenchAddressSuggestion>[];

    for (final item in raw.whereType<Map>()) {
      final map = Map<String, dynamic>.from(item);
      final prediction = map['placePrediction'];
      if (prediction is! Map) continue;
      final predictionMap = Map<String, dynamic>.from(prediction);

      final textMap = predictionMap['text'];
      final fullText = textMap is Map
          ? _firstString(textMap['text'])
          : '';

      final structured = predictionMap['structuredFormat'];
      var mainText = '';
      var secondaryText = '';
      if (structured is Map) {
        final structuredMap = Map<String, dynamic>.from(structured);
        final main = structuredMap['mainText'];
        final secondary = structuredMap['secondaryText'];
        if (main is Map) mainText = _firstString(main['text']);
        if (secondary is Map) secondaryText = _firstString(secondary['text']);
      }

      final street = mainText.isNotEmpty ? mainText : fullText;
      if (street.isEmpty) continue;

      final label = fullText.isNotEmpty
          ? fullText
          : (secondaryText.isNotEmpty ? '$street — $secondaryText' : street);

      suggestions.add(
        FrenchAddressSuggestion(
          label: label,
          city: fallbackCity,
          postalCode: fallbackPostal,
          street: street,
        ),
      );
    }

    return _uniqueByLabel(suggestions, maxCount: _maxSuggestions);
  }

  Future<List<FrenchAddressSuggestion>> _searchGeoPfAddresses(
    String query, {
    String? type,
    String? postcode,
    String? city,
    required String Function(String city, String postalCode, String street)
        labelBuilder,
  }) async {
    final trimmed = query.trim();
    if (trimmed.length < 3) return [];

    final params = <String, String>{
      'q': trimmed,
      'limit': '$_maxSuggestions',
      'autocomplete': '1',
      'index': 'address',
    };
    if (type != null) params['type'] = type;
    if (postcode != null && postcode.isNotEmpty) {
      params['postcode'] = postcode;
    }
    if (city != null && city.isNotEmpty) params['city'] = city;

    final uri = Uri.https(_geopfHost, _geopfSearchPath, params);

    try {
      final response = await _client.get(uri);
      if (response.statusCode != 200) return [];

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final features = body['features'] as List<dynamic>? ?? [];
      final suggestions = <FrenchAddressSuggestion>[];

      for (final feature in features.whereType<Map<String, dynamic>>()) {
        final properties =
            feature['properties'] as Map<String, dynamic>? ?? {};
        final suggestionCity = _firstString(
          properties['city'] ?? properties['municipality'],
        );
        final suggestionPostal = _firstString(properties['postcode']);
        final featureType = _firstString(properties['type']);
        final street =
            featureType == 'municipality' ? '' : _firstString(properties['name']);
        final label = labelBuilder(
          suggestionCity,
          suggestionPostal,
          street,
        ).trim();
        if (label.isEmpty) continue;

        suggestions.add(
          FrenchAddressSuggestion(
            label: label,
            city: suggestionCity,
            postalCode: suggestionPostal,
            street: street,
          ),
        );
      }

      return _uniqueByLabel(suggestions);
    } catch (_) {
      return [];
    }
  }

  List<FrenchAddressSuggestion> _uniqueByLabel(
    Iterable<FrenchAddressSuggestion> suggestions, {
    int? maxCount,
  }) {
    final seenLabels = <String>{};
    final unique = <FrenchAddressSuggestion>[];
    for (final suggestion in suggestions) {
      final key = suggestion.label.trim().toLowerCase();
      if (key.isEmpty || !seenLabels.add(key)) continue;
      unique.add(suggestion);
      if (maxCount != null && unique.length >= maxCount) break;
    }
    return unique;
  }

  String _firstString(dynamic value) {
    if (value is String) return value;
    if (value is List && value.isNotEmpty) return value.first.toString();
    return '';
  }

  /// Libère le client HTTP.
  void dispose() {
    _client.close();
  }
}
