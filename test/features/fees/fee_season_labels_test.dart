import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/fees/utils/fee_season_labels.dart';

void main() {
  test('buildSeasonLabelOptions génère 4 saisons consécutives', () {
    final options = buildSeasonLabelOptions(2026);
    expect(options, ['2025-2026', '2026-2027', '2027-2028', '2028-2029']);
    expect(defaultSeasonLabel(2026), '2026-2027');
  });
}
