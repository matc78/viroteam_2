part of 'app_copy.dart';

/// Wizard création / setup club.
final class AppCopyClubSetup {
  const AppCopyClubSetup();

  String get stepPrerequisites => 'Prérequis';
  String get stepIdentity => 'Identité';
  String get stepObjectives => 'Objectifs';
  String get stepMemberCount => 'Effectif';
  String get stepHeadquarters => 'Siège';
  String get stepPracticeLocations => 'Lieux d\'entraînement/match';
  String get stepRecap => 'Récap';

  List<String> get stepLabels => [
        stepPrerequisites,
        stepIdentity,
        stepObjectives,
        stepMemberCount,
        stepHeadquarters,
        stepPracticeLocations,
        stepRecap,
      ];

  String get recapSubtitle =>
      'Tout est prêt — reviens en arrière pour corriger si besoin.';
  String get identityTitle => 'Identité';
  String get detailsTitle => 'Détails';
  String get locationTitle => 'Localisation';
  String get prioritiesTitle => 'Priorités';
  String get prerequisitesTitle => 'Avant de commencer';
  String get prerequisitesSubtitle =>
      'Quelques infos et c\'est lancé — on sauvegarde au fur et à mesure.';
  String get headquartersSubtitle => 'Où se trouve le siège du club ?';
  String get identitySubtitle =>
      'Nom et sport pour démarrer. Le logo, c\'est bonus.';
  String get clubNameLabel => 'Nom du club';
  String get clubNameHint => 'Ex. Viroflay Volley club';
  String get addAnotherLocation => 'Ajouter un autre lieu';
  String get addThisLocation => 'Ajouter ce lieu';
  String get noLocation => 'Aucun lieu';
  String get noPriority => 'Aucune priorité';
  String get specifyType => 'Précise le type';
  String get cityLabel => 'Ville';
  String get cityHint => 'Ex. Viroflay';
  String get addressLabel => 'Adresse';
  String get addressHint => 'Rue, numéro ou lieu…';
  String get clubAddressLabel => 'Adresse du club';
  String get postalCodeLabel => 'Code postal';
  String get postalCodeHint => '78220';

  String get resumeDraft => 'Reprise de ta création en cours';
  String get letsGo => 'C\'est parti';
  String get createClub => 'Créer le club';
  String get validationNameSport =>
      'Nom du club (2 caractères min.) et sport requis.';
  String get validationNameSportShort => 'Nom du club et sport requis.';
  String get validationObjectives => 'Sélectionne au moins un objectif.';
  String get validationMemberCount =>
      'Indique le nombre de membres approximatif.';
  String get validationCityRequired => 'Ville du club requise.';
  String get validationPracticeLocation =>
      'Ajoute au moins un lieu de pratique.';
  String get validationCityFirst => 'Renseigne d\'abord la ville du club.';
  String get validationCityAndLocation =>
      'Ville et au moins un lieu de pratique requis.';
  String get validationProfileMissing =>
      'Profil introuvable. Reconnecte-toi ou vérifie ta connexion.';
  String createError(Object error) => 'Erreur lors de la création : $error';

  String get prereqNameSportTitle => 'Nom et sport du club';
  String get prereqNameSportSubtitle => 'Comme tes membres te connaissent';
  String get prereqCityTitle => 'Ville et lieu de pratique';
  String get prereqCitySubtitle => 'Stade, salle, gymnase…';
  String get prereqLogoTitle => 'Logo du club';
  String get prereqLogoSubtitle => 'Ajoutable ou modifiable plus tard';
  String get prereqPrioritiesTitle => 'Tes priorités';
  String get prereqPrioritiesSubtitle => 'Planning, cotisations, annonces…';
  String get prereqAdminTitle => 'Rôle administrateur';
  String get prereqAdminSubtitle => 'Invite tes membres par code';

  String get editLogo => 'Modifier le logo';
  String get addLogoOptional => 'Ajouter un logo (optionnel)';
  String get sportPracticed => 'Sport pratiqué';

  String get objectivesSubtitle =>
      'Coche ce qui compte le plus — tu pourras tout utiliser ensuite.';
  String get memberCountQuestion =>
      'Combien de membres gères-tu environ ?';
  String get memberCountDragHint =>
      'Fais glisser puis choisis un effectif.';
  String approxMemberCount(String recap) => '≈ $recap';

  String get practiceSubtitleOther =>
      'Ajoute d\'autres lieux si besoin (optionnel si le siège suffit).';
  String get practiceSubtitleFirst =>
      'Ajoute au moins un lieu d\'entraînement/match.';
  String get newLocation => 'Nouveau lieu';
  String get locationTypeLabel => 'Type de lieu';
  String get locationsAdded => 'Lieux ajoutés';
  String get useHeadquartersAddress =>
      'Utiliser l\'adresse du siège du club comme lieu d\'entraînement/match';
  String get useHeadquartersCity =>
      'Utiliser la ville du siège du club comme lieu d\'entraînement/match';

  String get recapName => 'Nom';
  String get recapSport => 'Sport';
  String get recapLogo => 'Logo';
  String get recapLogoAdded => 'Ajouté';
  String get recapLogoNotAdded => 'Non ajouté';
  String get recapDescription => 'Description';
  String get recapHeadquarters => 'Siège';
  String get recapLocations => 'Lieux';
  String get recapHeadcount => 'Effectif';

  String get rangeUnder30 => '< 30';
  String get range30to100 => '30 – 100';
  String get range100to300 => '100 – 300';
  String get rangeOver300 => '300+';
  String membersCount(String key) => '$key membres';
  String get recapUnder30 => 'Moins de 30 membres';
  String get recap30to100 => '30 à 100 membres';
  String get recap100to300 => '100 à 300 membres';
  String get recapOver300 => 'Plus de 300 membres';

  String get locCityStade => 'City-stade';
  String get locStadium => 'Stade';
  String get locGymnasium => 'Gymnase';
  String get locAthleticsTrack => "Piste d'athlétisme";
  String get locHealthTrail => 'Parcours santé';
  String get locForest => 'Forêt';
  String get locLake => 'Lac';
  String get locPool => 'Piscine';
  String get locDojo => 'Dojo';
  String get locTennisCourt => 'Court de tennis';
  String get locFencingHall => "Salle d'armes";
  String get locNauticalBase => 'Base nautique';
  String get locOther => 'Autre';
}
