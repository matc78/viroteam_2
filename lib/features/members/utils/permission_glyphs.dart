import 'package:viro_team_v2/config/viro_glyphs.dart';
import 'package:viro_team_v2/models/club_permission.dart';

/// Icône sur mesure d'un droit club (feuille d'attribution des droits).
ViroGlyph glyphOfPermission(ClubPermission permission) => switch (permission) {
  ClubPermission.admin => ViroGlyph.admin,
  ClubPermission.manageMembers => ViroGlyph.licence,
  ClubPermission.manageTeams => ViroGlyph.maillot,
  ClubPermission.manageEvents => ViroGlyph.calendrier,
  ClubPermission.manageAnnouncements => ViroGlyph.megaphone,
  ClubPermission.manageFees => ViroGlyph.piece,
  ClubPermission.viewFees => ViroGlyph.oeil,
  ClubPermission.manageClubSettings => ViroGlyph.clubHouse,
  ClubPermission.manageEquipment => ViroGlyph.plot,
  ClubPermission.manageChat => ViroGlyph.bulles,
  ClubPermission.viewActivity => ViroGlyph.journal,
};

/// Icône sur mesure d'une fonction (raccourci de droits).
ViroGlyph glyphOfFunction(ClubFunction function) => switch (function) {
  ClubFunction.feesManager => ViroGlyph.piece,
  ClubFunction.announcementsManager => ViroGlyph.megaphone,
  ClubFunction.membersManager => ViroGlyph.licence,
  ClubFunction.sportsManager => ViroGlyph.sifflet,
  ClubFunction.equipmentManager => ViroGlyph.plot,
};
