import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/equipment/utils/equipment_categories.dart';

void main() {
  test('football inclut Ballons et Buts', () {
    final labels = equipmentCategoriesForSport('Football');
    expect(labels, contains('Ballons'));
    expect(labels, contains('Buts'));
    expect(labels, contains('Entraînement'));
  });

  test('tennis inclut Raquettes et Balles', () {
    final labels = equipmentCategoriesForSport('Tennis');
    expect(labels, contains('Raquettes'));
    expect(labels, contains('Balles'));
    expect(labels, isNot(contains('Buts')));
  });

  test('presetForStored reconnaît les libellés du sport', () {
    final footballLabels = equipmentCategoriesForSport('Football');
    expect(
      EquipmentCategoryPresets.presetForStored('Ballons', footballLabels),
      'Ballons',
    );
    expect(
      EquipmentCategoryPresets.presetForStored('Raquettes', footballLabels),
      EquipmentCategoryPresets.other,
    );
  });

  test('storedValue renvoie le preset ou le libellé libre', () {
    expect(
      EquipmentCategoryPresets.storedValue(
        preset: 'Chasubles',
        customLabel: '',
      ),
      'Chasubles',
    );
    expect(
      EquipmentCategoryPresets.storedValue(
        preset: EquipmentCategoryPresets.other,
        customLabel: '  Raquettes  ',
      ),
      'Raquettes',
    );
  });
}
