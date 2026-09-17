import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:viro_team_v2/config/viro_colors.dart';

final _urlPattern = RegExp(
  r'''(?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]}'"]''',
  caseSensitive: false,
);

/// Adresse FR simple : n° + voie, ou CP + ville.
final _addressPattern = RegExp(
  r'''\b\d{1,4}\s+(?:bis\s+|ter\s+)?(?:rue|av(?:enue)?|bd|boulevard|chemin|impasse|place|allée|allee|route|cours|quai)\s+[A-Za-zÀ-ÿ0-9'’.\-\s]{3,60}|\b\d{5}\s+[A-Za-zÀ-ÿ'’.\-]{2,}(?:\s+[A-Za-zÀ-ÿ'’.\-]{2,}){0,3}\b''',
  caseSensitive: false,
);

/// Segment de texte message (texte brut, URL ou adresse).
sealed class MessageTextSegment {
  const MessageTextSegment(this.value);
  final String value;
}

/// Texte non cliquable.
final class MessageTextPlain extends MessageTextSegment {
  const MessageTextPlain(super.value);
}

/// Lien URL.
final class MessageTextUrl extends MessageTextSegment {
  const MessageTextUrl(super.value, this.href);
  final String href;
}

/// Adresse → Google Maps.
final class MessageTextAddress extends MessageTextSegment {
  const MessageTextAddress(super.value, this.href);
  final String href;
}

class _Hit {
  const _Hit({
    required this.start,
    required this.end,
    required this.kind,
    required this.value,
  });

  final int start;
  final int end;
  final String kind;
  final String value;
}

String _normalizeUrl(String raw) {
  final trimmed = raw.trim();
  if (RegExp(r'^https?:\/\/', caseSensitive: false).hasMatch(trimmed)) {
    return trimmed;
  }
  return 'https://$trimmed';
}

String _mapsHref(String address) {
  return 'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address.trim())}';
}

bool _overlaps(_Hit a, _Hit b) => a.start < b.end && b.start < a.end;

List<_Hit> _collectMatches(String text, RegExp pattern, String kind) {
  final out = <_Hit>[];
  for (final match in pattern.allMatches(text)) {
    out.add(
      _Hit(
        start: match.start,
        end: match.end,
        kind: kind,
        value: match.group(0)!,
      ),
    );
  }
  return out;
}

/// Découpe le texte en segments texte / URL / adresse.
List<MessageTextSegment> segmentMessageText(String text) {
  if (text.isEmpty) return const [];
  final urlHits = _collectMatches(text, _urlPattern, 'url');
  final addressHits = _collectMatches(text, _addressPattern, 'address')
      .where((hit) => !urlHits.any((url) => _overlaps(hit, url)))
      .toList();
  final hits = [...urlHits, ...addressHits]
    ..sort((a, b) => a.start.compareTo(b.start));

  final segments = <MessageTextSegment>[];
  var cursor = 0;
  for (final hit in hits) {
    if (hit.start < cursor) continue;
    if (hit.start > cursor) {
      segments.add(MessageTextPlain(text.substring(cursor, hit.start)));
    }
    if (hit.kind == 'url') {
      segments.add(MessageTextUrl(hit.value, _normalizeUrl(hit.value)));
    } else {
      segments.add(MessageTextAddress(hit.value, _mapsHref(hit.value)));
    }
    cursor = hit.end;
  }
  if (cursor < text.length) {
    segments.add(MessageTextPlain(text.substring(cursor)));
  }
  return segments;
}

/// Extrait les URLs d’un texte (galerie médias).
List<String> extractUrlsFromText(String text) {
  final urls = <String>[];
  for (final segment in segmentMessageText(text)) {
    if (segment is MessageTextUrl) urls.add(segment.href);
  }
  return urls;
}

Future<void> _launchHref(String href) async {
  final uri = Uri.tryParse(href);
  if (uri == null) return;
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Construit les [InlineSpan] linkifiés pour une bulle texte.
List<InlineSpan> linkifyInlineSpans(
  String text, {
  TextStyle? style,
  TextStyle? linkStyle,
  List<TapGestureRecognizer>? recognizers,
}) {
  final segments = segmentMessageText(text);
  if (segments.isEmpty) {
    return [TextSpan(text: text, style: style)];
  }
  final resolvedLinkStyle = linkStyle ??
      (style ?? const TextStyle()).copyWith(
        color: ViroColors.primary600,
        decoration: TextDecoration.underline,
        decorationColor: ViroColors.primary600,
      );
  final spans = <InlineSpan>[];
  for (final segment in segments) {
    switch (segment) {
      case MessageTextPlain(:final value):
        spans.add(TextSpan(text: value, style: style));
      case MessageTextUrl(:final value, :final href) ||
            MessageTextAddress(:final value, :final href):
        final recognizer = TapGestureRecognizer()
          ..onTap = () {
            _launchHref(href);
          };
        recognizers?.add(recognizer);
        spans.add(
          TextSpan(
            text: value,
            style: resolvedLinkStyle,
            recognizer: recognizer,
          ),
        );
    }
  }
  return spans;
}
