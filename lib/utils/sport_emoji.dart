/// Emoji sport aligné sur le portail (`sportEmoji.ts`) et [ClubSports].
String sportEmoji(String? sport) {
  final key = _normalizeSportKey(sport);
  if (key.isEmpty) return '🏅';
  return _sportEmojiByKey[key] ?? '🏅';
}

/// Libellé club avec emoji sport (ex. « 🏐 viro volley »).
String clubLabelWithSportEmoji({required String name, String? sport}) {
  final trimmed = name.trim().isEmpty ? 'Club' : name.trim();
  return '${sportEmoji(sport)} $trimmed';
}

String _normalizeSportKey(String? sport) {
  if (sport == null) return '';
  var key = sport.toLowerCase().trim();
  const accents = {
    'à': 'a',
    'â': 'a',
    'ä': 'a',
    'é': 'e',
    'è': 'e',
    'ê': 'e',
    'ë': 'e',
    'î': 'i',
    'ï': 'i',
    'ô': 'o',
    'ö': 'o',
    'ù': 'u',
    'û': 'u',
    'ü': 'u',
    'ç': 'c',
  };
  final buffer = StringBuffer();
  for (final rune in key.runes) {
    final char = String.fromCharCode(rune);
    buffer.write(accents[char] ?? char);
  }
  return buffer.toString().replaceAll('-', '');
}

const Map<String, String> _sportEmojiByKey = {
  'football': '⚽',
  'basketball': '🏀',
  'volleyball': '🏐',
  'handball': '🤾',
  'rugby': '🏉',
  'tennis': '🎾',
  'natation': '🏊',
  'athletisme': '🏃',
  'judo': '🥋',
  'escrime': '🤺',
  'aviron': '🚣',
  'autre': '🏅',
};
