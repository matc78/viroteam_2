import 'dart:convert';

import 'package:http/http.dart' as http;

/// Suggestion d'adresse française (API Géoplateforme / BAN + Nominatim OSM).
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

/// Autocomplete adresses via Géoplateforme (BAN) + lieux sportifs via Nominatim.
class FrenchAddressService {
  FrenchAddressService({http.Client? client}) : _client = client ?? http.Client();

  static const _geopfHost = 'data.geopf.fr';
  static const _geopfSearchPath = '/geocodage/search';
  static const _nominatimHost = 'nominatim.openstreetmap.org';
  static const _nominatimUserAgent =
      'ViroTeamClubSetup/1.0 (https://viroteam.app; club-setup app)';
  static const _maxSuggestions = 8;
  static const _seedLimit = 20;
  static const _nominatimMinInterval = Duration(milliseconds: 1100);

  /// Une seule requête seed (évite 5×~1,1 s de throttle Nominatim à l’ouverture).
  static const _venueSeedQuery = 'gymnase';

  static const _sportOsmTypes = {
    'stadium',
    'pitch',
    'sports_centre',
    'sports_hall',
    'fitness_centre',
    'swimming_pool',
    'swimming_area',
    'track',
    'golf_course',
    'horse_riding',
    'ice_rink',
    'climbing',
    'dojo',
    'marina',
    'recreation_ground',
  };

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
    'complexe sportif',
  ];

  final http.Client _client;
  final Map<String, List<FrenchAddressSuggestion>> _venueCache = {};
  DateTime? _lastNominatimRequestAt;
  Future<void> _nominatimChain = Future.value();

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
        : await _searchGeoPfAddresses(
            trimmed,
            postcode: postalCode.trim(),
            city: cityName,
            labelBuilder: (city, postcode, street) => street,
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
      final cacheKey = '${city.toLowerCase()}|$postcode';
      final cached = _venueCache[cacheKey];
      if (cached != null) return cached;

      final venues = await _searchNominatim(
        city: city,
        seedQuery: _venueSeedQuery,
        postcode: postcode,
      );
      _venueCache[cacheKey] = venues;
      return venues;
    }

    return _searchNominatim(
      city: city,
      query: query,
      postcode: postcode,
    );
  }

  Future<List<FrenchAddressSuggestion>> _searchNominatim({
    required String city,
    String? query,
    String? seedQuery,
    String postcode = '',
  }) async {
    final cityName = city.trim();
    if (cityName.isEmpty) return [];

    try {
      if (seedQuery != null) {
        final results = await _throttledNominatimSearch(
          query: seedQuery,
          city: cityName,
          limit: _seedLimit,
        );
        return _mapNominatimResults(
          results,
          cityName,
          expectedPostcode: postcode,
        );
      }

      final trimmed = query?.trim() ?? '';
      if (trimmed.length < 2) return [];

      final results = await _throttledNominatimSearch(
        query: trimmed,
        city: cityName,
      );
      return _mapNominatimResults(
        results,
        cityName,
        expectedPostcode: postcode,
      );
    } catch (_) {
      return [];
    }
  }

  /// Sérialise les appels Nominatim (~1 req/s), comme le proxy web.
  Future<List<Map<String, dynamic>>> _throttledNominatimSearch({
    required String query,
    required String city,
    int? limit,
  }) {
    late final Future<List<Map<String, dynamic>>> scheduled;
    scheduled = _nominatimChain.then((_) => _runNominatimSearch(
          query: query,
          city: city,
          limit: limit,
        ));
    _nominatimChain = scheduled.then(
      (_) {},
      onError: (_) {},
    );
    return scheduled;
  }

  Future<List<Map<String, dynamic>>> _runNominatimSearch({
    required String query,
    required String city,
    int? limit,
  }) async {
    final lastAt = _lastNominatimRequestAt;
    if (lastAt != null) {
      final wait = _nominatimMinInterval - DateTime.now().difference(lastAt);
      if (wait > Duration.zero) {
        await Future<void>.delayed(wait);
      }
    }
    _lastNominatimRequestAt = DateTime.now();

    final q = '${query.trim()} ${city.trim()}'.trim();
    final uri = Uri.https(_nominatimHost, '/search', {
      'q': q,
      'format': 'json',
      'addressdetails': '1',
      'limit': '${limit ?? _maxSuggestions}',
      'countrycodes': 'fr',
    });

    final response = await _client.get(
      uri,
      headers: {
        'Accept': 'application/json',
        'User-Agent': _nominatimUserAgent,
      },
    );
    if (response.statusCode != 200) return [];

    final body = jsonDecode(response.body);
    if (body is! List) return [];

    return body.whereType<Map<String, dynamic>>().toList();
  }

  List<FrenchAddressSuggestion> _mapNominatimResults(
    List<Map<String, dynamic>> results,
    String fallbackCity, {
    String expectedPostcode = '',
  }) {
    final suggestions = <FrenchAddressSuggestion>[];
    final targetCity = _normalizePlace(fallbackCity);
    final targetPostcode = expectedPostcode.trim();

    for (final result in results) {
      if (!_isSportsOsmResult(result)) continue;

      final name = (result['name'] as String?)?.trim() ?? '';
      if (name.isEmpty) continue;

      final address = result['address'] as Map<String, dynamic>? ?? {};
      final nominatimCity = _cityFromNominatim(address);
      if (nominatimCity.isNotEmpty &&
          _normalizePlace(nominatimCity) != targetCity) {
        continue;
      }

      final suggestionPostal = _firstString(address['postcode']);
      if (targetPostcode.isNotEmpty &&
          suggestionPostal.isNotEmpty &&
          suggestionPostal != targetPostcode) {
        continue;
      }

      final suggestionCity =
          nominatimCity.isNotEmpty ? nominatimCity : fallbackCity;
      final road = _firstString(address['road']).trim();
      final label = road.isNotEmpty ? '$name — $road' : name;

      suggestions.add(
        FrenchAddressSuggestion(
          label: label,
          city: suggestionCity,
          postalCode: suggestionPostal,
          street: name,
          isSportsVenue: true,
        ),
      );
    }

    return _uniqueByLabel(suggestions);
  }

  String _cityFromNominatim(Map<String, dynamic> address) {
    return _firstString(
      address['city'] ??
          address['town'] ??
          address['village'] ??
          address['municipality'],
    );
  }

  /// Lieu sportif OSM : type connu, ou classe leisure/sport/amenity + token.
  ///
  /// Ne matche pas une rue / adresse civile uniquement sur le nom
  /// (ex. « Rue du Stade »).
  bool _isSportsOsmResult(Map<String, dynamic> result) {
    final type = (result['type'] as String? ?? '').toLowerCase();
    final osmClass = (result['class'] as String? ?? '').toLowerCase();
    final name = (
      (result['name'] as String?) ??
          (result['display_name'] as String?) ??
          ''
    ).toLowerCase();

    if (_sportOsmTypes.contains(type)) return true;
    if (osmClass == 'leisure' || osmClass == 'sport' || osmClass == 'amenity') {
      return _matchesSportTokens(name);
    }
    return false;
  }

  String _normalizePlace(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'\s+'), ' ')
        .replaceAll('-', ' ');
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
