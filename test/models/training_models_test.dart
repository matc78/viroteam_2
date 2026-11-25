import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';

void main() {
  group('TrainingFeedbackDraft', () {
    test('ne part qu’avec les deux notes collectives', () {
      expect(TrainingFeedbackDraft.empty.canSend, isFalse);
      expect(const TrainingFeedbackDraft(levelRating: 4).canSend, isFalse);
      expect(
        const TrainingFeedbackDraft(levelRating: 3.5, engagementRating: 5)
            .canSend,
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

    test('messagesFor garde les messages non vides des joueurs de la séance',
        () {
      final draft = TrainingFeedbackDraft.empty
          .withPlayerMessage('p1', '  Bravo  ')
          .withPlayerMessage('p2', '   ')
          .withPlayerMessage('ancien', 'Hors séance');
      expect(draft.messagesFor(['p1', 'p2']), {'p1': 'Bravo'});
    });

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
  });
}
