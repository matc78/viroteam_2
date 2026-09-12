part of 'app_copy.dart';

/// Textes du journal d’activité club.
final class AppCopyActivity {
  const AppCopyActivity();

  String get screenTitle => 'Dernières actions';
  String get emptyTitle => 'Rien pour l’instant';
  String get emptyBody =>
      'Les prochaines actions du club (membres, events, invitations…) '
      'apparaîtront ici.';
  String get loadError => 'Impossible de charger le journal.';

  /// Libellé dérivé du type + count quand `summary` est vide.
  String titleForType(String type, int count) {
    final n = count < 1 ? 1 : count;
    switch (type) {
      case 'members_added':
        return n == 1
            ? '1 membre ajouté'
            : '$n membres ajoutés';
      case 'members_removed':
        return n == 1
            ? '1 membre retiré'
            : '$n membres retirés';
      case 'invitations_sent':
        return n == 1
            ? '1 invitation envoyée'
            : '$n invitations envoyées';
      case 'events_created':
        return n == 1
            ? '1 événement créé'
            : '$n événements créés';
      case 'event_cancelled':
        return n == 1
            ? '1 événement annulé'
            : '$n événements annulés';
      case 'team_created':
        return n == 1 ? '1 équipe créée' : '$n équipes créées';
      case 'announcement_published':
        return n == 1 ? '1 annonce publiée' : '$n annonces publiées';
      default:
        return 'Action club';
    }
  }

  String byActor(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return 'Par un membre du staff';
    return 'Par $trimmed';
  }
}
