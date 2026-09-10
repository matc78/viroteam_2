part of 'app_copy.dart';

/// Inventaire / équipement.
final class AppCopyEquipment {
  const AppCopyEquipment();

  String get empty =>
      'Inventaire vide — ajoute ton premier matos.';
  String get emptySearch => 'Rien trouvé de ce côté';
  String get none => 'Aucune';

  String get screenTitle => 'Équipements';
  String get intro =>
      'Stock simple du club : quantités, état, emplacement.';
  String get searchHint => 'Rechercher…';
  String get allCategories => 'Toutes catégories';
  String get allConditions => 'Tous états';
  String get conditionOk => 'OK';
  String get conditionUsed => 'Usé';
  String get conditionBroken => 'HS';
  String get created => 'Équipement ajouté';
  String get updated => 'Équipement mis à jour';
  String get deleted => 'Équipement supprimé';
  String get deleteConfirmTitle => 'Supprimer cet équipement ?';
  String deleteConfirmBody(String name) =>
      '« $name » sera retiré de l’inventaire.';
  String get nameRequired => 'Indique un nom.';
  String get typeRequiredCustom => 'Précise le type.';
  String get typeRequired => 'Choisis un type.';
  String get quantityMin => 'Quantité min. 1.';
  String get nameLabel => 'Nom';
  String get nameHint => 'Ballon match';
  String get typeLabel => 'Type';
  String get otherEllipsis => 'Autre…';
  String get specifyLabel => 'Préciser';
  String get specifyHint => 'Raquettes, plots…';
  String get quantityLabel => 'Quantité';
  String get conditionSection => 'État';
  String get locationLabel => 'Emplacement';
  String get locationHint => 'Local U14…';
  String get teamLabel => 'Équipe';
  String get notesLabel => 'Notes';
  String get notesHint => 'Optionnel';
  String get editTitle => 'Modifier l’équipement';
  String get createTitle => 'Nouvel équipement';
  String get closeTooltip => 'Fermer';

  String get catBalls => 'Ballons';
  String get catGoals => 'Buts';
  String get catBibs => 'Chasubles';
  String get catProtections => 'Protections';
  String get catBaskets => 'Paniers';
  String get catNets => 'Filets';
  String get catPosts => 'Poteaux';
  String get catRackets => 'Raquettes';
  String get catTennisBalls => 'Balles';
  String get catPool => 'Piscine';
  String get catFins => 'Palmes';
  String get catGoggles => 'Lunettes';
  String get catMats => 'Tatamis';
  String get catBelts => 'Ceintures';
  String get catWeapons => 'Armes';
  String get catMasks => 'Masques';
  String get catGloves => 'Gants';
  String get catBoats => 'Embarcations';
  String get catOars => 'Rames';
  String get catHarness => 'Harnais';
  String get catJump => 'Saut';
  String get catThrow => 'Lancer';
  String get catTraining => 'Entraînement';
  String get catHall => 'Salle';
  String get catTextile => 'Textile';
}
