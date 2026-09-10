part of 'app_copy.dart';

/// Sync calendrier externe.
final class AppCopyCalendar {
  const AppCopyCalendar();

  String get noUpcoming =>
      'Rien à venir au planning pour ce club.';
  String get actionFailed => 'Action calendrier impossible';
  String get screenTitle => 'Calendrier dynamique';
  String get intro =>
      'Ajoute le planning ViroTeam à l’agenda de ton téléphone. '
      'Réexporte après une mise à jour pour synchroniser les changements.';
  String get addToAgendaSection => 'Ajouter à mon agenda';
  String get addDynamicCalendar =>
      'Ajouter le calendrier dynamique à mon agenda';
  String get icsReady =>
      'Fichier calendrier prêt — ouvre-le pour l’ajouter à ton agenda';
  String get manualImportSection => 'Import manuel';
  String get iosTitle => 'iPhone / iPad';
  String get androidTitle => 'Android';
  String get shareIcsText =>
      'Planning ViroTeam — importe ce fichier dans ton calendrier.';

  List<String> get iosSteps => const [
        'Appuie sur « Ajouter le calendrier dynamique… » ci-dessus.',
        'Choisis « Enregistrer dans Fichiers » ou partage vers Mail.',
        'Ouvre le fichier .ics → « Ajouter » / « Ajouter les événements ».',
        'Sélectionne le calendrier (iCloud ou local) puis confirme.',
      ];

  List<String> get androidSteps => const [
        'Exporte le fichier .ics via le bouton ci-dessus.',
        'Ouvre le fichier avec Google Agenda (ou l’app Calendrier).',
        'Confirme l’import des événements dans le calendrier souhaité.',
        'Astuce : depuis Gmail / Drive, ouvre le .ics pour l’importer.',
      ];
}
