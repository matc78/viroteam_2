/// Catalogue unique des textes UI de l’app (FR).
///
/// Voix : pote de vestiaire (tutoiement). Voir PROJECT_CONVENTIONS §5bis.
/// Usage : `Text(AppCopy.home.quietSubtitle)` — pas de littéraux dans les widgets.
library;

part 'app_copy_common.dart';
part 'app_copy_auth.dart';
part 'app_copy_home.dart';
part 'app_copy_members.dart';
part 'app_copy_planning.dart';
part 'app_copy_fees.dart';
part 'app_copy_teams.dart';
part 'app_copy_club.dart';
part 'app_copy_settings.dart';
part 'app_copy_join.dart';
part 'app_copy_announcements.dart';
part 'app_copy_equipment.dart';
part 'app_copy_calendar.dart';
part 'app_copy_club_setup.dart';

/// Point d’entrée des libellés UI.
abstract final class AppCopy {
  static const common = AppCopyCommon();
  static const auth = AppCopyAuth();
  static const home = AppCopyHome();
  static const members = AppCopyMembers();
  static const planning = AppCopyPlanning();
  static const fees = AppCopyFees();
  static const teams = AppCopyTeams();
  static const club = AppCopyClub();
  static const settings = AppCopySettings();
  static const join = AppCopyJoin();
  static const announcements = AppCopyAnnouncements();
  static const equipment = AppCopyEquipment();
  static const calendar = AppCopyCalendar();
  static const clubSetup = AppCopyClubSetup();
}
