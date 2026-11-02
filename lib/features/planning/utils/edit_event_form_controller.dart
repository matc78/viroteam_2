import 'package:flutter/material.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/services/event_service.dart';

/// Contrôleur du formulaire « Modifier l'événement » (une occurrence) :
/// valeurs saisies, validation et écriture des seuls champs modifiés, pour que
/// le trigger push n'envoie « reporté » / « modifié » qu'à bon escient.
class EditEventFormController extends ChangeNotifier {
  /// Préremplit le formulaire avec les infos actuelles de [event].
  EditEventFormController(this.event)
      : date = DateTime(event.date.year, event.date.month, event.date.day),
        start = addEventParseTime(event.startTime) ??
            const TimeOfDay(hour: 18, minute: 0),
        end = addEventParseTime(event.endTime) ??
            const TimeOfDay(hour: 19, minute: 30),
        meetingTime = addEventParseTime(event.meetingTime) ??
            const TimeOfDay(hour: 17, minute: 30) {
    titleController.text = event.title;
    locationController.text = event.location ?? '';
    meetingLocationController.text = event.meetingLocation ?? '';
    titleController.addListener(notifyListeners);
    locationController.addListener(notifyListeners);
    meetingLocationController.addListener(notifyListeners);
  }

  /// Événement d'origine (référence du diff).
  final ClubEvent event;

  final TextEditingController titleController = TextEditingController();
  final TextEditingController locationController = TextEditingController();
  final TextEditingController meetingLocationController =
      TextEditingController();

  DateTime date;
  TimeOfDay start;
  TimeOfDay end;
  TimeOfDay meetingTime;
  bool saving = false;

  /// Index du lieu club sélectionné, ou [addEventLocationOtherIndex] (« Autre »).
  int? selectedLocationIndex;
  bool _locationSelectionSeeded = false;

  /// Vrai si l'événement est un match (heure de RDV, pas d'heure de fin).
  bool get isMatch => event.type == EventTypes.match;

  /// Match à l'extérieur : lieu libre (pas la liste des lieux du club).
  bool get isAwayMatch =>
      isMatch && event.matchVenue == MatchVenues.away;

  /// Titre libre (et modifiable) seulement sans équipe : réunion, autre.
  bool get hasEditableTitle => EventTypes.isTeamless(event.type);

  /// Vrai une fois le dropdown lieu initialisé depuis les lieux du club.
  bool get locationSelectionSeeded => _locationSelectionSeeded;

  /// Vrai si le champ texte « Autre » / lieu libre doit être affiché.
  bool showCustomLocationField(List<PracticeLocation> practiceLocations) {
    if (isAwayMatch || practiceLocations.isEmpty) return true;
    return selectedLocationIndex == addEventLocationOtherIndex;
  }

  /// Initialise le dropdown lieu une seule fois à partir de [practiceLocations].
  ///
  /// Si la liste est encore vide (club en cours de chargement), n'enregistre
  /// pas le seed : on réessaiera au prochain build avec les lieux réels.
  void seedLocationSelection(List<PracticeLocation> practiceLocations) {
    if (_locationSelectionSeeded) return;
    if (isAwayMatch) {
      _locationSelectionSeeded = true;
      selectedLocationIndex = addEventLocationOtherIndex;
      return;
    }
    if (practiceLocations.isEmpty) return;

    _locationSelectionSeeded = true;
    final matchedIndex = addEventMatchingPracticeLocationIndex(
      practiceLocations,
      locationController.text,
    );
    selectedLocationIndex = matchedIndex ?? addEventLocationOtherIndex;
    if (matchedIndex != null) {
      locationController.text =
          addEventPracticeLocationLabel(practiceLocations[matchedIndex]);
    }
    notifyListeners();
  }

  /// Met à jour le lieu choisi (index club ou « Autre ») et synchronise le texte.
  void setSelectedLocationIndex(
    int? index,
    List<PracticeLocation> practiceLocations,
  ) {
    selectedLocationIndex = index;
    if (index != null &&
        index >= 0 &&
        index < practiceLocations.length) {
      locationController.text =
          addEventPracticeLocationLabel(practiceLocations[index]);
    }
    notifyListeners();
  }

  /// Met à jour le jour de l'événement.
  void setDate(DateTime value) {
    date = DateTime(value.year, value.month, value.day);
    notifyListeners();
  }

  /// Met à jour l'heure de début (heure du match pour un match).
  void setStartTime(TimeOfDay value) {
    start = value;
    notifyListeners();
  }

  /// Met à jour l'heure de fin (hors match).
  void setEndTime(TimeOfDay value) {
    end = value;
    notifyListeners();
  }

  /// Met à jour l'heure de RDV (match).
  void setMeetingTime(TimeOfDay value) {
    meetingTime = value;
    notifyListeners();
  }

  /// Première raison qui empêche d'enregistrer, ou `null` si valide.
  String? get blockingReason {
    if (event.type == EventTypes.other &&
        titleController.text.trim().isEmpty) {
      return AppCopy.planning.titleRequired;
    }
    if (!isMatch) {
      final startMinutes = start.hour * 60 + start.minute;
      final endMinutes = end.hour * 60 + end.minute;
      if (endMinutes <= startMinutes) return AppCopy.planning.endTimeAfterStart;
    }
    if (locationController.text.trim().isEmpty) {
      return AppCopy.planning.locationRequired;
    }
    return null;
  }

  bool get _dateChanged =>
      date.year != event.date.year ||
      date.month != event.date.month ||
      date.day != event.date.day;

  String? _changedTitle() {
    if (!hasEditableTitle) return null;
    final title = titleController.text.trim();
    return title == event.title.trim() ? null : title;
  }

  String? _changedTime(TimeOfDay value, String? original) {
    final formatted = addEventFormatTime(value);
    return formatted == original?.trim() ? null : formatted;
  }

  String? _changedLocation() {
    final location = locationController.text.trim();
    return location == (event.location ?? '').trim() ? null : location;
  }

  String get _meetingLocation => meetingLocationController.text.trim();

  bool get _meetingLocationChanged =>
      _meetingLocation != (event.meetingLocation ?? '').trim();

  /// Vrai si au moins un champ diffère de l'événement d'origine.
  bool get hasChanges =>
      _changedTitle() != null ||
      _dateChanged ||
      _changedTime(start, event.startTime) != null ||
      (!isMatch && _changedTime(end, event.endTime) != null) ||
      (isMatch && _changedTime(meetingTime, event.meetingTime) != null) ||
      _changedLocation() != null ||
      _meetingLocationChanged;

  /// Écrit les champs modifiés via [eventService]. Retourne `false` si rien
  /// n'a changé ou si le formulaire est invalide (rien n'est écrit).
  Future<bool> save({
    required String clubId,
    required EventService eventService,
  }) async {
    if (blockingReason != null || !hasChanges) return false;
    saving = true;
    notifyListeners();
    try {
      await eventService.updateEventDetails(
        clubId: clubId,
        eventId: event.id,
        title: _changedTitle(),
        date: _dateChanged ? date : null,
        startTime: _changedTime(start, event.startTime),
        endTime: isMatch ? null : _changedTime(end, event.endTime),
        meetingTime:
            isMatch ? _changedTime(meetingTime, event.meetingTime) : null,
        location: _changedLocation(),
        meetingLocation: _meetingLocationChanged && _meetingLocation.isNotEmpty
            ? _meetingLocation
            : null,
        clearMeetingLocation:
            _meetingLocationChanged && _meetingLocation.isEmpty,
      );
      return true;
    } finally {
      saving = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    titleController.dispose();
    locationController.dispose();
    meetingLocationController.dispose();
    super.dispose();
  }
}
