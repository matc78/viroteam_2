import 'dart:math' as math;

import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Fond du tableau blanc (volley) : terrain entier, demi-terrain ou blanc.
enum WhiteboardCourt {
  full('full'),
  half('half'),
  blank('blank');

  const WhiteboardCourt(this.id);

  final String id;

  /// Valeur Firestore → fond (terrain entier par défaut).
  static WhiteboardCourt fromId(Object? raw) =>
      values.firstWhere((c) => c.id == raw, orElse: () => WhiteboardCourt.full);
}

/// Outil d'un trait : main levée ou flèche (du premier au dernier point).
enum WhiteboardStrokeKind {
  pen('pen'),
  arrow('arrow');

  const WhiteboardStrokeKind(this.id);

  final String id;

  static WhiteboardStrokeKind fromId(Object? raw) => values.firstWhere(
    (k) => k.id == raw,
    orElse: () => WhiteboardStrokeKind.pen,
  );
}

/// Couleur sémantique d'un trait (résolue par le thème au dessin).
enum WhiteboardInk {
  accent('accent'),
  red('red'),
  dark('dark');

  const WhiteboardInk(this.id);

  final String id;

  static WhiteboardInk fromId(Object? raw) =>
      values.firstWhere((i) => i.id == raw, orElse: () => WhiteboardInk.accent);
}

/// Type de jeton posé sur le terrain.
enum WhiteboardTokenKind {
  /// Joueur de mon équipe (numéroté).
  player('player'),

  /// Joueur adverse (numéroté).
  opponent('opponent'),
  ball('ball');

  const WhiteboardTokenKind(this.id);

  final String id;

  static WhiteboardTokenKind fromId(Object? raw) => values.firstWhere(
    (k) => k.id == raw,
    orElse: () => WhiteboardTokenKind.player,
  );
}

/// Point normalisé (0–1) dans le cadre du terrain.
class WhiteboardPoint {
  const WhiteboardPoint(this.x, this.y);

  final double x;
  final double y;

  /// Point borné au cadre [0, 1].
  WhiteboardPoint clamped() =>
      WhiteboardPoint(x.clamp(0.0, 1.0), y.clamp(0.0, 1.0));
}

/// Trait dessiné (coordonnées normalisées, donc indépendant de l'écran).
class WhiteboardStroke {
  const WhiteboardStroke({
    required this.kind,
    required this.ink,
    required this.points,
  });

  final WhiteboardStrokeKind kind;
  final WhiteboardInk ink;
  final List<WhiteboardPoint> points;

  /// Données Firestore : points à plat `[x0, y0, x1, y1…]` arrondis.
  Map<String, dynamic> toMap() => {
    'kind': kind.id,
    'ink': ink.id,
    'points': [
      for (final p in points) ...[_round(p.x), _round(p.y)],
    ],
  };

  /// Lit un trait ; `null` s'il a moins de deux points valides.
  static WhiteboardStroke? fromMap(Object? raw) {
    if (raw is! Map) return null;
    final flat = raw['points'];
    if (flat is! List) return null;
    final points = <WhiteboardPoint>[];
    for (var i = 0; i + 1 < flat.length; i += 2) {
      final x = flat[i];
      final y = flat[i + 1];
      if (x is num && y is num) {
        points.add(WhiteboardPoint(x.toDouble(), y.toDouble()).clamped());
      }
    }
    if (points.length < 2) return null;
    return WhiteboardStroke(
      kind: WhiteboardStrokeKind.fromId(raw['kind']),
      ink: WhiteboardInk.fromId(raw['ink']),
      points: points,
    );
  }
}

/// Jeton posé sur le terrain (joueur numéroté, adversaire ou ballon).
class WhiteboardToken {
  const WhiteboardToken({
    required this.kind,
    required this.position,
    this.label = '',
  });

  final WhiteboardTokenKind kind;
  final WhiteboardPoint position;

  /// Numéro affiché (vide pour le ballon).
  final String label;

  /// Copie déplacée en [position].
  WhiteboardToken movedTo(WhiteboardPoint position) =>
      WhiteboardToken(kind: kind, position: position.clamped(), label: label);

  /// Copie renumérotée ([label] rogné, au plus [maxLabelLength] caractères).
  WhiteboardToken withLabel(String label) {
    final trimmed = label.trim();
    return WhiteboardToken(
      kind: kind,
      position: position,
      label: trimmed.length > maxLabelLength
          ? trimmed.substring(0, maxLabelLength)
          : trimmed,
    );
  }

  /// Longueur max d'un numéro de jeton (comme le portail).
  static const int maxLabelLength = 2;

  /// True si le jeton porte un numéro modifiable (joueur, adversaire).
  bool get hasLabel => kind != WhiteboardTokenKind.ball;

  Map<String, dynamic> toMap() => {
    'kind': kind.id,
    'x': _round(position.x),
    'y': _round(position.y),
    'label': label,
  };

  static WhiteboardToken? fromMap(Object? raw) {
    if (raw is! Map) return null;
    final x = raw['x'];
    final y = raw['y'];
    if (x is! num || y is! num) return null;
    return WhiteboardToken(
      kind: WhiteboardTokenKind.fromId(raw['kind']),
      position: WhiteboardPoint(x.toDouble(), y.toDouble()).clamped(),
      label: raw['label'] as String? ?? '',
    );
  }
}

/// Contenu d'un tableau blanc d'exercice, stocké en vectoriel dans
/// `drills/{drillId}.boards[]` (ancien champ unique `board` encore lu).
class WhiteboardData {
  const WhiteboardData({
    this.court = WhiteboardCourt.full,
    this.strokes = const [],
    this.tokens = const [],
  });

  static const empty = WhiteboardData();

  /// Points max d'un trait après simplification (garde la taille du document
  /// bien sous la limite Firestore).
  static const int maxPointsPerStroke = 120;

  /// Traits max par tableau.
  static const int maxStrokes = 80;

  /// Jetons max par tableau.
  static const int maxTokens = 24;

  final WhiteboardCourt court;
  final List<WhiteboardStroke> strokes;
  final List<WhiteboardToken> tokens;

  bool get isEmpty => strokes.isEmpty && tokens.isEmpty;

  /// Copie avec les champs fournis.
  WhiteboardData copyWith({
    WhiteboardCourt? court,
    List<WhiteboardStroke>? strokes,
    List<WhiteboardToken>? tokens,
  }) => WhiteboardData(
    court: court ?? this.court,
    strokes: strokes ?? this.strokes,
    tokens: tokens ?? this.tokens,
  );

  Map<String, dynamic> toMap() => {
    'court': court.id,
    FirestoreFields.strokes: [for (final s in strokes) s.toMap()],
    FirestoreFields.tokens: [for (final t in tokens) t.toMap()],
  };

  /// Lit un tableau ; [WhiteboardData.empty] si absent ou illisible.
  static WhiteboardData fromMap(Object? raw) {
    if (raw is! Map) return empty;
    final strokes = raw[FirestoreFields.strokes];
    final tokens = raw[FirestoreFields.tokens];
    return WhiteboardData(
      court: WhiteboardCourt.fromId(raw['court']),
      strokes: strokes is List
          ? strokes.map(WhiteboardStroke.fromMap).nonNulls.toList()
          : const [],
      tokens: tokens is List
          ? tokens.map(WhiteboardToken.fromMap).nonNulls.toList()
          : const [],
    );
  }

  /// Réduit [points] à au plus [maxPoints] en gardant le premier et le
  /// dernier (décimation régulière : le tracé reste lisible).
  static List<WhiteboardPoint> simplify(
    List<WhiteboardPoint> points, {
    int maxPoints = maxPointsPerStroke,
  }) {
    if (points.length <= maxPoints || maxPoints < 2) return points;
    final step = (points.length - 1) / (maxPoints - 1);
    return [for (var i = 0; i < maxPoints; i++) points[(i * step).round()]];
  }
}

/// Partie d'une flèche saisie : une extrémité ou le trait entier.
enum WhiteboardArrowPart { start, end, body }

/// Flèche trouvée sous un point : index dans `strokes` et partie saisie.
typedef WhiteboardArrowHit = ({int index, WhiteboardArrowPart part});

/// Flèche de [board] sous [point] (repère normalisé) pour un tableau de
/// [width] × [height] : les extrémités d'abord (rayon [handleRadius]), puis
/// le trait (distance ≤ [bodyTolerance]), de la plus récente à la plus
/// ancienne. Miroir de `arrowAt` du portail.
WhiteboardArrowHit? whiteboardArrowAt(
  WhiteboardData board,
  WhiteboardPoint point, {
  required double width,
  required double height,
  required double handleRadius,
  required double bodyTolerance,
}) {
  double distance(WhiteboardPoint a, WhiteboardPoint b) {
    final dx = (a.x - b.x) * width;
    final dy = (a.y - b.y) * height;
    return math.sqrt(dx * dx + dy * dy);
  }

  final strokes = board.strokes;
  for (var i = strokes.length - 1; i >= 0; i--) {
    final stroke = strokes[i];
    if (stroke.kind != WhiteboardStrokeKind.arrow || stroke.points.length < 2) {
      continue;
    }
    if (distance(stroke.points.last, point) <= handleRadius) {
      return (index: i, part: WhiteboardArrowPart.end);
    }
    if (distance(stroke.points.first, point) <= handleRadius) {
      return (index: i, part: WhiteboardArrowPart.start);
    }
  }
  final tx = point.x * width;
  final ty = point.y * height;
  for (var i = strokes.length - 1; i >= 0; i--) {
    final stroke = strokes[i];
    if (stroke.kind != WhiteboardStrokeKind.arrow || stroke.points.length < 2) {
      continue;
    }
    for (var j = 1; j < stroke.points.length; j++) {
      final ax = stroke.points[j - 1].x * width;
      final ay = stroke.points[j - 1].y * height;
      final bx = stroke.points[j].x * width;
      final by = stroke.points[j].y * height;
      final lengthSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
      final t = lengthSq == 0
          ? 0.0
          : (((tx - ax) * (bx - ax) + (ty - ay) * (by - ay)) / lengthSq).clamp(
              0.0,
              1.0,
            );
      final cx = ax + t * (bx - ax);
      final cy = ay + t * (by - ay);
      final gap = math.sqrt((cx - tx) * (cx - tx) + (cy - ty) * (cy - ty));
      if (gap <= bodyTolerance) {
        return (index: i, part: WhiteboardArrowPart.body);
      }
    }
  }
  return null;
}

/// Flèche [stroke] déplacée : une extrémité amenée en [point], ou le trait
/// entier translaté de [origin] → [point] sans sortir du schéma. Miroir de
/// `dragArrow` du portail.
WhiteboardStroke whiteboardDragArrow(
  WhiteboardStroke stroke,
  WhiteboardArrowPart part,
  WhiteboardPoint origin,
  WhiteboardPoint point,
) {
  if (part != WhiteboardArrowPart.body) {
    final at = part == WhiteboardArrowPart.start ? 0 : stroke.points.length - 1;
    return WhiteboardStroke(
      kind: stroke.kind,
      ink: stroke.ink,
      points: [
        for (var i = 0; i < stroke.points.length; i++)
          i == at ? point.clamped() : stroke.points[i],
      ],
    );
  }
  final xs = stroke.points.map((p) => p.x);
  final ys = stroke.points.map((p) => p.y);
  final dx = math.min(
    1 - xs.reduce(math.max),
    math.max(-xs.reduce(math.min), point.x - origin.x),
  );
  final dy = math.min(
    1 - ys.reduce(math.max),
    math.max(-ys.reduce(math.min), point.y - origin.y),
  );
  return WhiteboardStroke(
    kind: stroke.kind,
    ink: stroke.ink,
    points: [
      for (final p in stroke.points)
        WhiteboardPoint(_round(p.x + dx), _round(p.y + dy)),
    ],
  );
}

double _round(double value) => (value * 1000).roundToDouble() / 1000;
