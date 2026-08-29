import 'dart:convert';

import 'package:http/http.dart' as http;

/// Suggestion d'adresse française (API Géoplateforme / BAN).
class FrenchAddressSuggestion {
  const FrenchAddressSuggestion({
    required this.label,
    required this.city,
    required this.postalCode,
    required this.street,
    this.isSportsVenue = false,
  });

  final String label;
  final String city;
  final String postalCode;

  /// Rue, numéro, ou nom du lieu (gymnase, stade…).
  final String street;

  /// `true` pour un gymnase, stade, piscine, etc.
  final bool isSportsVenue;
}

/// Autocomplete adresses via l'API publique Géoplateforme (France).
class FrenchAddressService {
  FrenchAddressService({http.Client? client}) : _client = client ?? http.Client();

  static const _host = 'data.geopf.fr';
  static const _searchPath = '/geocodage/search';
  static const _maxSuggestions = 8;
  static const _venueSeedQueries = [
    'gymnase',
    'stade',
    'piscine',
    'dojo',
    'omnisport',
  ];

  /// Tokens de catégories / toponymes sportifs (mot entier, pas sous-chaîne).
  static const _sportTokens = [
    'gymnase',
    'stade',
    'piscine',
    'dojo',
    'tennis',
    'omnisport',
    'hippodrome',
    'patinoire',
    'golf',
    'equestre',
    'équestre',
    'escalade',
    'baignade',
    'cyclisme',
    'salle d\'armes',
    'boulodrome',
    'sportif',
    'sports',
    'handball',
    'football',
    'rugby',
    'volleyball',
    'basketball',
    'judo',
    'escrime',
    'aviron',
    'natation',
    'athlétisme',
  ];

  final http.Client _client;
  final Map<String, List<FrenchAddressSuggestion>> _venueCache = {};

  /// Recherche des communes correspondant à [query] (min. 3 caractères).
  Future<List<FrenchAddressSuggestion>> searchCities(String query) {
    return _search(
      query,
      type: 'municipality',
      labelBuilder: (city, postalCode, _) {
        if (city.isEmpty) return '';
        if (postalCode.isEmpty) return city;
        return '$city ($postalCode)';
      },
    );
  }

  /// Recherche des rues / numéros et lieux sportifs dans [city].
  ///
  /// Sans saisie (ou moins de 3 caractères), propose les gymnases, stades,
  /// piscines, etc. de la commune — le siège est souvent au lieu de pratique.
  Future<List<FrenchAddressSuggestion>> searchStreets(
    String query, {
    required String city,
    String postalCode = '',
  }) async {
    final cityName = city.trim();
    if (cityName.isEmpty) return [];

    final trimmed = query.trim();
    final venues = await _searchSportsVenues(
      query: trimmed,
      city: cityName,
      postcode: postalCode.trim(),
    );
    final streets = trimmed.length < 3
        ? const <FrenchAddressSuggestion>[]
        : await _search(
            trimmed,
            postcode: postalCode.trim(),
            city: cityName,
            labelBuilder: (_, _, street) => street,
          );

    return _uniqueByLabel(
      [...venues, ...streets],
      maxCount: _maxSuggestions,
    );
  }

  Future<List<FrenchAddressSuggestion>> _searchSportsVenues({
    required String query,
    required String city,
    required String postcode,
  }) async {
    if (query.length < 3) {
      final cacheKey = '$city|$postcode';
      final cached = _venueCache[cacheKey];
      if (cached != null) return cached;
      final batches = await Future.wait(
        _venueSeedQueries.map(
          (seed) => _search(
            seed,
            index: 'poi',
            postcode: postcode,
            city: city,
            labelBuilder: (_, _, street) => street,
          ),
        ),
      );
      final venues = _uniqueByLabel(batches.expand((batch) => batch));
      _venueCache[cacheKey] = venues;
      return venues;
    }

    return _search(
      query,
      index: 'poi',
      postcode: postcode,
      city: city,
      labelBuilder: (_, _, street) => street,
    );
  }

  Future<List<FrenchAddressSuggestion>> _search(
    String query, {
    String index = 'address',
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
      'index': index,
    };
    if (type != null) params['type'] = type;
    if (postcode != null && postcode.isNotEmpty) {
      params['postcode'] = postcode;
    }
    if (city != null && city.isNotEmpty) params['city'] = city;

    final uri = Uri.https(_host, _searchPath, params);

    try {
      final response = await _client.get(uri);
      if (response.statusCode != 200) return [];

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final features = body['features'] as List<dynamic>? ?? [];
      final isPoi = index == 'poi';

      final suggestions = <FrenchAddressSuggestion>[];

      for (final feature in features.whereType<Map<String, dynamic>>()) {
        final properties =
            feature['properties'] as Map<String, dynamic>? ?? {};
        final suggestionCity = _firstString(
          properties['city'] ?? properties['municipality'],
        );
        final suggestionPostal = _firstString(properties['postcode']);
        final featureType = _firstString(properties['type']);
        final toponym = _firstString(
          properties['toponym'] ?? properties['toponyme'],
        );
        final name = _firstString(properties['name']);
        final categories = _stringList(properties['category']);
        final street = featureType == 'municipality'
            ? ''
            : (isPoi ? (name.isNotEmpty ? name : toponym) : name);
        if (isPoi &&
            !_matchesSportTokens('$categories $toponym $name')) {
          continue;
        }
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
            isSportsVenue: isPoi,
          ),
        );
      }

      return _uniqueByLabel(suggestions);
    } catch (_) {
      return [];
    }
  }

  bool _matchesSportTokens(String haystack) {
    final normalized = haystack.toLowerCase();
    return _sportTokens.any((token) {
      final pattern = RegExp(
        '(^|[^a-zà-ÿ])${RegExp.escape(token)}([^a-zà-ÿ]|\$)',
        unicode: true,
      );
      return pattern.hasMatch(normalized);
    });
  }

  List<String> _stringList(dynamic value) {
    if (value is String) return [value];
    if (value is List) {
      return value.map((item) => item.toString()).toList();
    }
    return [];
  }

  List<FrenchAddressSuggestion> _uniqueByLabel(
    Iterable<FrenchAddressSuggestion> suggestions, {
    int? maxCount,
  }) {
    final seenLabels = <String>{};
    final unique = <FrenchAddressSuggestion>[];
    for (final suggestion in suggestions) {
      if (!seenLabels.add(suggestion.label)) continue;
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
