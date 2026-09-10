part of 'app_copy.dart';

/// Actions génériques, rôles, erreurs soft, empty communs.
final class AppCopyCommon {
  const AppCopyCommon();

  String get save => 'Enregistrer';
  String get cancel => 'Annuler';
  String get confirm => 'Confirmer';
  String get delete => 'Supprimer';
  String get add => 'Ajouter';
  String get edit => 'Modifier';
  String get close => 'Fermer';
  String get retry => 'Réessayer';
  String get loading => 'Chargement…';
  String get search => 'Rechercher';
  String get none => 'Aucune';
  String get noneMasculine => 'Aucun';
  String get yes => 'Oui';
  String get no => 'Non';
  String get continueAction => 'Continuer';
  String get back => 'Retour';
  String get share => 'Partager';
  String get copy => 'Copier';
  String get done => 'Terminé';
  String get send => 'Envoyer';
  String get invite => 'Inviter';
  String get create => 'Créer';
  String get seeAll => 'Voir tout';
  String get hide => 'Masquer';
  String get saving => 'Enregistrement…';
  String get preparing => 'Préparation…';
  String get searchHint => 'Rechercher…';
  String get searchMemberHint => 'Chercher un membre…';
  String get clubNotFound => 'Club introuvable';
  String get memberFallback => 'Membre';
  String get childFallback => 'Enfant';
  String get pending => 'En attente';
  String get pendingAccount => 'Compte en attente';
  String get mail => 'Mail';
  String get extend => 'Prolonger';
  String get resend => 'Renvoyer';
  String get revoke => 'Révoquer';
  String get filterAll => 'Tous';

  String get rolePlayer => 'Joueur';
  String get roleCoach => 'Entraîneur';
  String get roleCoachShort => 'Coach';
  String get roleParent => 'Parent';
  String get roleAdmin => 'Admin';
  String get roleAdminFull => 'Administrateur';

  String get errorRetry => 'Oups, ça n’a pas passé. Réessaie dans un instant.';
  String errorWithDetails(Object error) => 'Oups : $error';
  String get errorGeneric => 'Oups, un truc a coincé.';
  String get errorOccurred => 'Oups, un truc a coincé';
  String get notConnected => 'Personne n’est connecté';
  String get sessionExpired => 'Session expirée — reconnecte-toi.';
  String get saveFailed => 'Enregistrement impossible.';
  String get saveFailedRetry => 'Enregistrement impossible, réessaie';

  String get emptySearch => 'Rien trouvé de ce côté';
  String get notProvided => 'Pas renseigné';
}
