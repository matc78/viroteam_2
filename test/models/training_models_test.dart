import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';

void main() {
  group('TrainingFeedbackDraft', () {
    test('ne part qu’avec les deux notes collectives', () {
      expect(TrainingFeedbackDraft.empty.canSend, isFalse);
      expect(const TrainingFeedbackDraft(levelRating: 4).canSend, isFalse);
      expect(
        const TrainingFeedbackDraft(
          levelRating: 3.5,
          engagementRating: 5,
        ).canSend,
        isTrue,
      );
    });

    test('TrainingRatings accepte les demi-étoiles 1–5', () {
      expect(TrainingRatings.isValid(3.5), isTrue);
      expect(TrainingRatings.isValid(1), isTrue);
      expect(TrainingRatings.isValid(0.5), isFalse);
      expect(TrainingRatings.isValid(3.3), isFalse);
      expect(TrainingRatings.format(4), '4');
      expect(TrainingRatings.format(3.5), '3.5');
    });

    test('une note entière (int Firestore) se lit en double', () {
      // Firestore stocke 4, pas 4.0.
      const draft = TrainingFeedbackDraft(levelRating: 4, engagementRating: 5);
      expect(draft.levelRating, 4.0);
      expect(draft.engagementRating, 5.0);
      expect(draft.canSend, isTrue);
      const feedback = TrainingFeedback(
        coachUid: 'c1',
        coachName: 'Léa',
        levelRating: 3,
        engagementRating: 4,
      );
      expect(feedback.levelRating, 3.0);
      expect(feedback.engagementRating, 4.0);
    });

    test(
      'messagesFor garde les messages non vides des joueurs de la séance',
      () {
        final draft = TrainingFeedbackDraft.empty
            .withPlayerMessage('p1', '  Bravo  ')
            .withPlayerMessage('p2', '   ')
            .withPlayerMessage('ancien', 'Hors séance');
        expect(draft.messagesFor(['p1', 'p2']), {'p1': 'Bravo'});
      },
    );

    test('fromSent reprend un retour déjà envoyé', () {
      final draft = TrainingFeedbackDraft.fromSent(
        feedback: const TrainingFeedback(
          coachUid: 'c1',
          coachName: 'Léa',
          levelRating: 3,
          engagementRating: 4,
          collectiveMessage: 'Belle énergie',
        ),
        messages: const [
          TrainingPlayerMessage(
            coachUid: 'c1',
            coachName: 'Léa',
            memberId: 'p1',
            message: 'Super',
          ),
        ],
      );
      expect(draft.levelRating, 3);
      expect(draft.engagementRating, 4);
      expect(draft.collectiveMessage, 'Belle énergie');
      expect(draft.playerMessages, {'p1': 'Super'});
    });
  });

  group('WhiteboardData', () {
    test('aller-retour Firestore des traits et jetons', () {
      const board = WhiteboardData(
        court: WhiteboardCourt.half,
        strokes: [
          WhiteboardStroke(
            kind: WhiteboardStrokeKind.arrow,
            ink: WhiteboardInk.red,
            points: [WhiteboardPoint(0.1, 0.2), WhiteboardPoint(0.8, 0.9)],
          ),
        ],
        tokens: [
          WhiteboardToken(
            kind: WhiteboardTokenKind.opponent,
            position: WhiteboardPoint(0.5, 0.25),
            label: '3',
          ),
        ],
      );
      final read = WhiteboardData.fromMap(board.toMap());
      expect(read.court, WhiteboardCourt.half);
      expect(
        WhiteboardData.fromMap(
          const WhiteboardData(court: WhiteboardCourt.blank).toMap(),
        ).court,
        WhiteboardCourt.blank,
      );
      expect(read.strokes.single.kind, WhiteboardStrokeKind.arrow);
      expect(read.strokes.single.ink, WhiteboardInk.red);
      expect(read.strokes.single.points.last.y, 0.9);
      expect(read.tokens.single.label, '3');
      expect(read.tokens.single.kind, WhiteboardTokenKind.opponent);
    });

    test('données illisibles → tableau vide, points bornés à 0–1', () {
      expect(WhiteboardData.fromMap('nope').isEmpty, isTrue);
      final read = WhiteboardData.fromMap({
        'strokes': [
          {
            'points': [-1, 2, 0.5, 0.5],
          },
          {
            'points': [0.1],
          },
        ],
      });
      expect(read.strokes, hasLength(1));
      expect(read.strokes.single.points.first.x, 0);
      expect(read.strokes.single.points.first.y, 1);
    });

    test('simplify garde premier et dernier point sous le plafond', () {
      final points = [
        for (var i = 0; i < 500; i++) WhiteboardPoint(i / 500, 0),
      ];
      final simplified = WhiteboardData.simplify(points, maxPoints: 50);
      expect(simplified, hasLength(50));
      expect(simplified.first, same(points.first));
      expect(simplified.last, same(points.last));
    });

    test('withLabel rogne et plafonne le numéro à 2 caractères', () {
      const token = WhiteboardToken(
        kind: WhiteboardTokenKind.player,
        position: WhiteboardPoint(0.5, 0.5),
        label: '1',
      );
      expect(token.withLabel(' 12 ').label, '12');
      expect(token.withLabel('123').label, '12');
      expect(token.withLabel('L').position.x, 0.5);
      expect(token.hasLabel, isTrue);
      expect(
        const WhiteboardToken(
          kind: WhiteboardTokenKind.ball,
          position: WhiteboardPoint(0, 0),
        ).hasLabel,
        isFalse,
      );
    });
  });

  group('Flèches du schéma (miroir du portail)', () {
    const arrow = WhiteboardStroke(
      kind: WhiteboardStrokeKind.arrow,
      ink: WhiteboardInk.accent,
      points: [WhiteboardPoint(0.2, 0.5), WhiteboardPoint(0.8, 0.5)],
    );
    const pen = WhiteboardStroke(
      kind: WhiteboardStrokeKind.pen,
      ink: WhiteboardInk.accent,
      points: [WhiteboardPoint(0.2, 0.2), WhiteboardPoint(0.8, 0.2)],
    );
    const board = WhiteboardData(strokes: [pen, arrow]);

    WhiteboardArrowHit? hit(WhiteboardPoint point) => whiteboardArrowAt(
      board,
      point,
      width: 100,
      height: 100,
      handleRadius: 3,
      bodyTolerance: 2,
    );

    test('saisit une extrémité, puis le trait, jamais un trait de crayon', () {
      expect(hit(const WhiteboardPoint(0.81, 0.5)), (
        index: 1,
        part: WhiteboardArrowPart.end,
      ));
      expect(hit(const WhiteboardPoint(0.2, 0.52)), (
        index: 1,
        part: WhiteboardArrowPart.start,
      ));
      expect(hit(const WhiteboardPoint(0.5, 0.51)), (
        index: 1,
        part: WhiteboardArrowPart.body,
      ));
      expect(hit(const WhiteboardPoint(0.5, 0.2)), isNull);
      expect(hit(const WhiteboardPoint(0.5, 0.6)), isNull);
    });

    test('déplace une extrémité seule ou le trait sans sortir du cadre', () {
      final end = whiteboardDragArrow(
        arrow,
        WhiteboardArrowPart.end,
        const WhiteboardPoint(0.8, 0.5),
        const WhiteboardPoint(0.9, 0.9),
      );
      expect(end.points.first.x, 0.2);
      expect(end.points.last.y, 0.9);

      final body = whiteboardDragArrow(
        arrow,
        WhiteboardArrowPart.body,
        const WhiteboardPoint(0.5, 0.5),
        const WhiteboardPoint(0.9, 0.6),
      );
      // Translation bornée : l'extrémité droite s'arrête au bord.
      expect(body.points.last.x, 1.0);
      expect(body.points.first.x, closeTo(0.4, 1e-9));
      expect(body.points.first.y, closeTo(0.6, 1e-9));
      expect(body.kind, WhiteboardStrokeKind.arrow);
    });
  });

  group('Préparation', () {
    test('ordered suit drillOrder, inconnus à la fin', () {
      const plan = TrainingPlan(coachUid: 'c1', drillOrder: ['b', 'a']);
      final ordered = plan.ordered(const [
        TrainingDrill(id: 'a'),
        TrainingDrill(id: 'c'),
        TrainingDrill(id: 'b'),
      ]);
      expect(ordered.map((d) => d.id), ['b', 'a', 'c']);
    });

    test('durées prévues et durée de séance', () {
      expect(
        plannedMinutes(const [
          TrainingDrill(id: 'a', durationMin: 20),
          TrainingDrill(id: 'b'),
          TrainingDrill(id: 'c', durationMin: 15),
        ]),
        35,
      );
      expect(sessionMinutes('19:00', '20:30'), 90);
      expect(sessionMinutes('19:00', null), isNull);
      expect(sessionMinutes('20:00', '19:00'), isNull);
    });

    test('TrainingDrill écrit boards et lit le legacy board', () {
      const multi = TrainingDrill(
        id: 'd1',
        boards: [
          WhiteboardData(court: WhiteboardCourt.half),
          WhiteboardData(court: WhiteboardCourt.blank),
        ],
      );
      final written = multi.toFirestore();
      expect(written[FirestoreFields.boards], hasLength(2));
      expect((written[FirestoreFields.boards] as List).first['court'], 'half');
      expect(written.containsKey(FirestoreFields.board), isFalse);

      final fromBoards = TrainingDrill.boardsFromData({
        FirestoreFields.boards: written[FirestoreFields.boards],
      });
      expect(fromBoards.map((b) => b.court), [
        WhiteboardCourt.half,
        WhiteboardCourt.blank,
      ]);
      expect(
        const TrainingDrill(
          id: 'd1',
          boards: [WhiteboardData(court: WhiteboardCourt.half)],
        ).hasBoards,
        isTrue,
      );
      expect(
        const TrainingDrill(
          id: 'd1',
          boards: [
            WhiteboardData.empty,
            WhiteboardData(
              court: WhiteboardCourt.blank,
              tokens: [
                WhiteboardToken(
                  kind: WhiteboardTokenKind.ball,
                  position: WhiteboardPoint(0.4, 0.4),
                ),
              ],
            ),
          ],
        ).previewBoard?.court,
        WhiteboardCourt.blank,
      );

      final legacy = TrainingDrill.boardsFromData({
        FirestoreFields.board: const WhiteboardData(
          court: WhiteboardCourt.full,
        ).toMap(),
      });
      expect(legacy, hasLength(1));
      expect(legacy.single.court, WhiteboardCourt.full);

      // boards vide + board legacy → on garde le legacy.
      final emptyBoardsWithLegacy = TrainingDrill.boardsFromData({
        FirestoreFields.boards: const [],
        FirestoreFields.board: const WhiteboardData(
          court: WhiteboardCourt.half,
        ).toMap(),
      });
      expect(emptyBoardsWithLegacy.single.court, WhiteboardCourt.half);
    });
  });
}
