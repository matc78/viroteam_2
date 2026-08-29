import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/models/club_equipment.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

final clubEquipmentProvider =
    FutureProvider.family<List<ClubEquipmentItem>, String>((ref, clubId) {
  return ref.read(equipmentServiceProvider).listItems(clubId);
});
