import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/models/club_access.dart';

/// Droits effectifs du compte connecté dans [clubId] : fiche
/// `members/{uid}` (droits + équipes entraînées) et réglages coach du club.
///
/// Point d'entrée unique côté app pour afficher ou masquer une action :
/// les écrans lisent ce provider, jamais un rôle. [ClubAccess.none] tant que
/// la fiche n'est pas chargée, ou pour un parent sans fiche.
final clubAccessProvider = Provider.family<ClubAccess, String>((ref, clubId) {
  final member = ref.watch(clubMemberProvider(clubId)).value;
  final club = ref.watch(clubProvider(clubId)).value;
  return ClubAccess.of(member: member, club: club);
});

/// `true` tant que la fiche du compte ou le club (réglages coach) ne sont pas
/// chargés (évite d'afficher un refus d'accès pendant le chargement).
final clubAccessLoadingProvider = Provider.family<bool, String>((ref, clubId) {
  return ref.watch(clubMemberProvider(clubId)).isLoading ||
      ref.watch(clubProvider(clubId)).isLoading;
});
