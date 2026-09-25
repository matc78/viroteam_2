import 'package:flutter/material.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club_setup/services/french_address_service.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/services/event_service.dart';

/// Contrôleur du formulaire « nouvel événement » (état, validation, création).
///
/// Possède les [TextEditingController] et notifie les écouteurs via
/// [ChangeNotifier]. À disposer avec le State de l’écran.
class AddEventFormController extends ChangeNotifier {
  /// Crée le contrôleur avec une date initiale (jour courant si absente).
  AddEventFormController({DateTime? initialDate}) {
    final now = DateTime.now();
    date = initialDate ?? DateTime(now.year, now.month, now.day);
    titleController.addListener(_onFormFieldEdited);
    locationController.addListener(_onFormFieldEdited);
    awayCityController.addListener(_onFormFieldEdited);
    awayPostalController.addListener(_onFormFieldEdited);
    awayAddressController.addListener(_onFormFieldEdited);
  }

  final TextEditingController locationController = TextEditingController();
  final TextEditingController titleController = TextEditingController();
  final TextEditingController awayCityController = TextEditingController();
  final TextEditingController awayPostalController = TextEditingController();
  final TextEditingController awayAddressController = TextEditingController();
  final FrenchAddressService addressService = FrenchAddressService();

  String type = EventTypes.training;
  String? teamId;
  late DateTime date;
  TimeOfDay start = const TimeOfDay(hour: 18, minute: 0);
  TimeOfDay end = const TimeOfDay(hour: 19, minute: 30);
  TimeOfDay meetingTime = const TimeOfDay(hour: 17, minute: 30);

  /// True dès que le coach ajuste manuellement l'heure de RDV.
  bool meetingTimeManuallyEdited = false;
  String? matchVenue;
  bool isRecurring = false;
  DateTime? recurrenceEndDate;
  bool saving = false;
  int? selectedLocationIndex;
  int? selectedMeetingLocationIndex;
  bool locationDefaultsApplied = false;

  /// Vrai si le type courant est un match.
  bool get isMatch => type == EventTypes.match;

  /// Vrai si le type courant est un entraînement.
  bool get isTraining => type == EventTypes.training;

  /// Match extérieur → saisie adresse FR ; sinon liste des lieux du club.
  bool get useAwayLocationField => isMatch && matchVenue == MatchVenues.away;

  void _onFormFieldEdited() => notifyListeners();

  /// Applique une seule fois le lieu par défaut (siège ou premier lieu).
  void applyLocationDefaults(Club club) {
    if (locationDefaultsApplied) return;
    locationDefaultsApplied = true;
    final index = addEventDefaultLocationIndex(club);
    if (index >= 0) {
      selectedLocationIndex = index;
      selectedMeetingLocationIndex = index;
    }
    notifyListeners();
  }

  /// Sélectionne la première équipe triée si aucune n’est encore choisie.
  void ensureDefaultTeam(List<ClubTeam> sortedTeams) {
    if (teamId != null || sortedTeams.isEmpty || type == EventTypes.other) {
      return;
    }
    teamId = sortedTeams.first.id;
    notifyListeners();
  }

  /// Met à jour le type et réinitialise les champs dépendants.
  void onTypeChanged(String? value) {
    final nextType = value ?? EventTypes.training;
    type = nextType;
    if (nextType == EventTypes.other) teamId = null;
    if (nextType == EventTypes.match) {
      isRecurring = false;
      recurrenceEndDate = null;
      matchVenue = MatchVenues.home;
      locationController.clear();
      clearAwayAddressFields();
    } else {
      matchVenue = null;
      clearAwayAddressFields();
    }
    notifyListeners();
  }

  /// Met à jour domicile / extérieur et nettoie le lieu si besoin.
  void onMatchVenueChanged(String? venue) {
    matchVenue = venue;
    if (venue == MatchVenues.home) {
      locationController.clear();
      clearAwayAddressFields();
    }
    notifyListeners();
  }

  /// Vide les champs d’adresse match extérieur.
  void clearAwayAddressFields() {
    awayCityController.clear();
    awayPostalController.clear();
    awayAddressController.clear();
  }

  /// Met à jour l’heure de début et recalcule le RDV si non édité manuellement.
  void setStartTime(TimeOfDay value) {
    start = value;
    if (!meetingTimeManuallyEdited) {
      meetingTime = addEventMeetingTimeFromStart(value);
    }
    notifyListeners();
  }

  /// Met à jour l’heure de fin.
  void setEndTime(TimeOfDay value) {
    end = value;
    notifyListeners();
  }

  /// Met à jour l’heure de RDV (marque comme édition manuelle).
  void setMeetingTime(TimeOfDay value) {
    meetingTimeManuallyEdited = true;
    meetingTime = value;
    notifyListeners();
  }

  /// Met à jour la date de l’événement et bornes la fin de récurrence.
  void setDate(DateTime value, {Club? club}) {
    date = value;
    if (recurrenceEndDate != null && recurrenceEndDate!.isBefore(date)) {
      recurrenceEndDate = addEventSeasonRecurrenceEnd(club, date);
    }
    notifyListeners();
  }

  /// Active / désactive la récurrence hebdo (préremplit la fin de saison).
  void setRecurring(bool value, {Club? club}) {
    isRecurring = value;
    if (value && recurrenceEndDate == null) {
      recurrenceEndDate = addEventSeasonRecurrenceEnd(club, date);
    }
    notifyListeners();
  }

  /// Met à jour la date de fin de récurrence.
  void setRecurrenceEndDate(DateTime value) {
    recurrenceEndDate = value;
    notifyListeners();
  }

  /// Met à jour l’équipe sélectionnée.
  void setTeamId(String? value) {
    teamId = value;
    notifyListeners();
  }

  /// Met à jour l’index du lieu de pratique.
  void setSelectedLocationIndex(int? value) {
    selectedLocationIndex = value;
    notifyListeners();
  }

  /// Met à jour l’index du lieu de RDV.
  void setSelectedMeetingLocationIndex(int? value) {
    selectedMeetingLocationIndex = value;
    notifyListeners();
  }

  /// Libellé du lieu de RDV sélectionné, ou `null` si absent.
  String? resolveMeetingLocation(Club? club) {
    final locations = club?.practiceLocations ?? const <PracticeLocation>[];
    final index = selectedMeetingLocationIndex;
    if (index != null && index >= 0 && index < locations.length) {
      return addEventPracticeLocationLabel(locations[index]);
    }
    return null;
  }

  /// Résout le lieu de l’événement (extérieur, liste club ou saisie libre).
  String? resolveLocation(Club? club) {
    if (useAwayLocationField) {
      return addEventResolveAwayLocation(
        address: awayAddressController.text,
        city: awayCityController.text,
        postal: awayPostalController.text,
      );
    }
    final locations = club?.practiceLocations ?? const <PracticeLocation>[];
    final index = selectedLocationIndex;
    if (index != null && index >= 0 && index < locations.length) {
      return addEventPracticeLocationLabel(locations[index]);
    }
    final fallback = locationController.text.trim();
    return fallback.isEmpty ? null : fallback;
  }

  /// Indique si tous les champs requis sont renseignés pour activer Créer.
  bool canCreate(Club? club) {
    if (type != EventTypes.other && (teamId == null || teamId!.isEmpty)) {
      return false;
    }
    if (type == EventTypes.other && titleController.text.trim().isEmpty) {
      return false;
    }
    if (isMatch && matchVenue == null) return false;

    final location = resolveLocation(club);
    if (location == null || location.isEmpty) return false;

    if (!isMatch) {
      final startMin = start.hour * 60 + start.minute;
      final endMin = end.hour * 60 + end.minute;
      if (endMin <= startMin) return false;
    }

    if (isTraining && isRecurring) {
      if (recurrenceEndDate == null) return false;
      if (recurrenceEndDate!.isBefore(date)) return false;
    }

    final practiceLocations =
        club?.practiceLocations ?? const <PracticeLocation>[];
    if (practiceLocations.isNotEmpty && resolveMeetingLocation(club) == null) {
      return false;
    }

    return true;
  }

  /// Message de validation à afficher, ou `null` si le formulaire est valide.
  String? validationMessage(Club? club) {
    if (type != EventTypes.other && teamId == null) {
      return AppCopy.planning.chooseTeamSnack;
    }
    if (type == EventTypes.other && titleController.text.trim().isEmpty) {
      return AppCopy.planning.titleRequired;
    }

    if (isMatch) {
      if (matchVenue == null) {
        return AppCopy.planning.indicateHomeOrAway;
      }
      if (matchVenue == MatchVenues.away &&
          addEventResolveAwayLocation(
                address: awayAddressController.text,
                city: awayCityController.text,
                postal: awayPostalController.text,
              ) ==
              null) {
        return AppCopy.planning.matchAddressRequired;
      }
    } else {
      final startMin = start.hour * 60 + start.minute;
      final endMin = end.hour * 60 + end.minute;
      if (endMin <= startMin) {
        return AppCopy.planning.endTimeAfterStart;
      }
    }

    if (isRecurring) {
      if (recurrenceEndDate == null) {
        return AppCopy.planning.chooseEndDate;
      }
      if (recurrenceEndDate!.isBefore(date)) {
        return AppCopy.planning.endDateAfterStart;
      }
    }

    final location = resolveLocation(club);
    if (location == null || location.isEmpty) {
      return AppCopy.planning.locationRequired;
    }

    return null;
  }

  /// Valide puis crée le(s) événement(s) via [eventService].
  ///
  /// Retourne le nombre créé, ou `null` si validation / auth échoue
  /// (le message est alors dans [validationMessage] ou déjà géré).
  Future<int?> save({
    required String clubId,
    required String? creatorId,
    required Club? club,
    required List<ClubTeam> teams,
    required List<ClubMember>? members,
    required EventService eventService,
  }) async {
    if (creatorId == null) return null;

    final error = validationMessage(club);
    if (error != null) return null;

    ClubTeam? team;
    if (teamId != null) {
      for (final candidate in teams) {
        if (candidate.id == teamId) {
          team = candidate;
          break;
        }
      }
    }

    final location = resolveLocation(club)!;

    saving = true;
    notifyListeners();
    try {
      return await eventService.createEvents(
        clubId: clubId,
        creatorId: creatorId,
        type: type,
        title: type == EventTypes.other
            ? titleController.text.trim()
            : (team?.name ?? ''),
        startDate: date,
        teamIds: team != null ? [team.id] : <String>[],
        teamMemberIds:
            team != null ? addEventAudienceForTeam(team, members) : <String>[],
        allTeams: false,
        location: location,
        startTime: addEventFormatTime(start),
        endTime: isMatch ? null : addEventFormatTime(end),
        meetingTime: isMatch ? addEventFormatTime(meetingTime) : null,
        meetingLocation: resolveMeetingLocation(club),
        matchVenue: isMatch ? matchVenue : null,
        recurrenceEndDate: isTraining && isRecurring ? recurrenceEndDate : null,
      );
    } finally {
      saving = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    titleController.removeListener(_onFormFieldEdited);
    locationController.removeListener(_onFormFieldEdited);
    awayCityController.removeListener(_onFormFieldEdited);
    awayPostalController.removeListener(_onFormFieldEdited);
    awayAddressController.removeListener(_onFormFieldEdited);
    locationController.dispose();
    titleController.dispose();
    awayCityController.dispose();
    awayPostalController.dispose();
    awayAddressController.dispose();
    addressService.dispose();
    super.dispose();
  }
}
