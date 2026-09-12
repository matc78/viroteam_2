part of 'app_copy.dart';

/// Cotisations admin / joueur.
final class AppCopyFees {
  const AppCopyFees();

  String get addToTrackingTitle => 'Ajouter au suivi ?';
  String get noActiveSeasonAdmin =>
      'Aucune saison active. Configure la saison pour suivre les cotisations.';
  String get noMembersToShow => 'Aucun membre à afficher';
  String get save => 'Enregistrer';
  String get addTier => 'Ajouter un palier';
  String tierIndex(int index) => 'Palier $index';
  String get delete => 'Supprimer';
  String get noActiveSeasonConfig =>
      'Aucune saison active — enregistre pour en créer une.';
  String get noActiveSeasonPlayer =>
      'Aucune saison de cotisation active.\nLe club te tiendra au courant.';
  String addPendingMembers(int count) =>
      'Ajouter $count membre${count > 1 ? 's' : ''}';

  String get screenTitle => 'Cotisations';
  String get tabConfig => 'Configuration';
  String get tabTracking => 'Suivi';
  String get myFeeTitle => 'Ma cotisation';
  String childFeeTitle(String label) => 'Cotisation de $label';
  String get loadFeeError => 'Impossible de charger la cotisation';
  String get clubNotFound => 'Club introuvable';
  String get sessionExpired => 'Session expirée.';
  String get configSaved => 'Configuration enregistrée';
  String get saving => 'Enregistrement…';
  String get updateDone => 'Mise à jour effectuée';
  String get tiersAssigned => 'Catégories assignées';

  String get statusAPayer => 'À payer';
  String get statusPartiel => 'Partiel';
  String get statusPaye => 'Payé';
  String get statusExonere => 'Exonéré';
  String get statusOverdue => 'En retard';
  String get statusDeadlineToday => 'Échéance aujourd\'hui';

  String get tierStandard => 'Standard';
  String get tierUnassigned => 'Non assigné';
  String get tierLabel => 'Libellé';
  String get tierLabelHint => 'U14, Senior, Licencié…';
  String get amount => 'Montant';
  String get amountHint => '150,00';
  String cardOnlineAmount(String amount) => 'CB en ligne : $amount';
  String cardOnlineFees(String fees) => 'dont $fees de frais';
  String get cardFeeInfoTooltip =>
      'Le montant CB couvre les frais Stripe (1,5 % + 0,25 €) '
      'et 1 € pour la plateforme, pour que le club reçoive '
      'le montant saisi.';

  String get sectionSeason => 'Saison';
  String get seasonSectionHint =>
      'Libellé et échéance de paiement des cotisations.';
  String get seasonLabel => 'Libellé saison';
  String get paymentDeadline => 'Date limite de paiement';
  String get optional => 'Optionnelle';
  String get sectionPayment => 'Paiement';
  String get sectionPaymentCollapsed => 'Paiement & consignes';
  String get paymentSectionHint => 'Instructions, IBAN et modes acceptés.';
  String get paymentInstructions => 'Instructions de paiement';
  String get paymentInstructionsHint => 'Ordre du chèque, coordonnées…';
  String get ibanLabel => 'IBAN (virement)';
  String get ibanHint => 'FR76…';
  String get paymentModes => 'Modes de paiement';
  String get sectionHelloAsso => 'HelloAsso';
  String get sectionStripe => 'Paiement CB (Stripe)';
  String get onlinePayment => 'Paiement en ligne';
  String get onlinePaymentSubtitle => 'Carte bancaire via Stripe';
  String get helloAssoSlug => 'Slug organisation HelloAsso';
  String get stripeConfigOnPortalHint =>
      'Configure Stripe Connect et active le paiement CB '
      'depuis le portail web (Cotisations → Stripe).';
  String get sectionTiers => 'Paliers tarifaires';
  String get tiersSectionHint =>
      'Un libellé et un montant par palier de cotisation.';
  String get setupStepSeasonTiers => 'Saison & tarifs';
  String get setupStepPayment => 'Paiement';
  String get setupNext => 'Continuer';
  String get setupBack => 'Retour';
  String setupStepOf(int step, int total) => 'Étape $step sur $total';

  String get payOnlineTitle => 'Payer en ligne';
  String get comingSoon => 'Bientôt disponible';
  String get paymentSoonBody =>
      'Le paiement en ligne via Stripe arrive bientôt. '
      'En attendant, utilise les moyens de paiement indiqués '
      'par ton club.';

  String get overdueBanner =>
      'Cotisation en retard. Merci de régulariser selon les consignes ci-dessous.';
  String get deadlineTodayBanner =>
      'Échéance aujourd\'hui — règle ta cotisation avant la fin de la journée.';
  String feeUpToDate(String seasonLabel) =>
      'Ta cotisation $seasonLabel est à jour';
  String confirmedOn(String date) => 'Confirmé le $date';
  String get paidViaHelloAsso => 'Payé via HelloAsso';
  String get paidViaStripe => 'Payé via Stripe';
  String get paidOffline => 'Payé hors-ligne';
  String get downloadAttestation => 'Télécharger l\'attestation PDF';
  String exemptForSeason(String seasonLabel) =>
      'Tu es exonéré(e) de cotisation pour la saison $seasonLabel.';
  String paidAmount(String amount) => 'Payé : $amount';
  String dueAmount(String amount) => 'Dû : $amount';
  String pendingAidAmount(String amount) => 'Aide en attente : $amount';
  String remainingAmount(String amount) => 'Reste : $amount';
  String get fieldNeedsTier => 'Tarif à assigner';
  String get fieldSettled => 'Soldé';
  String get fieldUpToDateHint =>
      'À jour — les corrections détaillées se font sur le portail.';
  String get fieldMarkPaidTitle => 'Marquer payé';
  String fieldMarkPaidSubtitle(String amount) =>
      'Enregistre le reste ($amount) en espèces';
  String get fieldPartialPayment => 'Encaisser un montant';
  String get fieldPartialPaymentSubtitle =>
      'Chèque, espèces, ANCV… (montant libre)';
  String get fieldAssignTierTitle => 'Assigner un tarif';
  String get fieldAssignTierSubtitle => 'Choisis le palier pour ce membre';
  String trackingSubtitle({
    required String tierLabel,
    required String due,
    required String paid,
    required String remaining,
    required bool showPaidBreakdown,
  }) {
    if (!showPaidBreakdown) return '$tierLabel · $due';
    return '$tierLabel · ${dueAmount(due)} · ${paidAmount(paid)} · ${remainingAmount(remaining)}';
  }

  String get adjustPaidAmount => 'Corriger le déjà payé';
  String get adjustPaidAmountSubtitle =>
      'Rectifie le montant encaissé (erreur de saisie, trop-perçu…)';
  String get adjustPaidAmountHint =>
      'Indique le total déjà encaissé pour ce membre (pas un nouveau paiement).';
  String get adjustPaidNoteHint => 'Motif de la correction (optionnel)';
  String get adjustPaidSaved => 'Montant déjà payé mis à jour';
  String get markPaidOfflineHint => 'Enregistre le reste dû (espèces)';
  String categoryLabel(String label) => 'Catégorie : $label';
  String get aidValidated => 'Validée';
  String get aidRejected => 'Refusée';
  String get aidProof => 'Justificatif';
  String get deadlineLabel => 'Date limite';
  String get noDeadline => 'Pas de date limite';
  String get payOnline => 'Payer en ligne';
  String get paymentGuidelines => 'Consignes de paiement';
  String get iban => 'IBAN';
  String get ibanCopied => 'IBAN copié';
  String get acceptedPaymentMethods => 'Moyens de paiement acceptés';
  String get helloAssoAvailableAbove =>
      'Le paiement en ligne via HelloAsso est disponible ci-dessus.';
  String get helloAssoComingSoonFollowClub =>
      'Le paiement en ligne via HelloAsso arrive bientôt. '
      'En attendant, suis les consignes du club.';
  String get stripeAvailableAbove =>
      'Le paiement en ligne via Stripe est disponible ci-dessus '
      '(carte, Apple Pay, Google Pay).';
  String get stripeComingSoonFollowClub =>
      'Le paiement en ligne via Stripe arrive bientôt. '
      'En attendant, suis les consignes du club.';
  String childFeeNotConfigured(String label) =>
      'La cotisation de $label n\'a pas encore été paramétrée par le club.';
  String get myFeeNotConfigured =>
      'Ta cotisation n\'a pas encore été paramétrée par le club.';

  String feeSeasonTitle(String seasonLabel) => 'Cotisation $seasonLabel';
  String get toSettle => 'à régler';
  String beforeDeadline(String date) => 'avant le $date';

  String get validateOffline => 'Valider hors-ligne';
  String get validateOfflineSubtitle => 'Chèque, espèces, ANCV, virement…';
  String get methodLabel => 'Moyen';
  String get amountEuros => 'Montant (€)';
  String get validate => 'Valider';
  String remainingLabel(String amount) => 'Reste : $amount';

  String get checkoutTitle => 'Payer ma cotisation';
  String totalDue(String amount) => 'Total dû : $amount';
  String get hasAidToggle => 'J\'ai une aide / réduction';
  String get hasAidSubtitle => 'Pass\'Sport, Pass+, ANCV, code promo…';
  String get aidType => 'Type d\'aide';
  String get aidAmountEuros => 'Montant de l\'aide (€)';
  String get aidAmountHint => '50';
  String get promoCodeOptional => 'Code promo (optionnel)';
  String get aidPendingHint =>
      'L\'aide passera en « attente de justificatif » ; '
      'seul le reste est encaissé par carte.';
  String get cardPaymentHelloAsso => 'Paiement carte (HelloAsso)';
  String get cardPaymentStripe => 'Paiement carte (Stripe)';
  String get once => '1 fois';
  String get threeTimes => '3 fois';
  String aidDiscount(String amount) => 'Aide : − $amount';
  String cardAmountDue(String amount, {required bool inThreeTimes}) =>
      'À payer par CB : $amount${inThreeTimes ? ' (en 3 fois)' : ''}';
  String cardFeesIncluded(String fees) =>
      'dont $fees de frais en payant par CB';
  String get opening => 'Ouverture…';
  String payAmount(String amount) => 'Payer $amount';
  String get saveAid => 'Enregistrer l\'aide';
  String get webhookConfirmHint =>
      'La cotisation n\'est confirmée qu\'après le webhook Stripe, '
      'pas juste après le paiement dans l\'app.';

  String selectedMembers(int count) =>
      '$count membre${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}';
  String get markPaid => 'Marquer payé';
  String get markExempt => 'Marquer exonéré';
  String get markUnpaid => 'Marquer à payer';
  String get assignCategory => 'Assigner une catégorie';
  String selectedCountLabel(int count) => '$count sélectionné(s)';

  String get allMembersHaveFee => 'Tous les membres ont déjà une fiche.';
  String createFeeSheetsBody(int count) =>
      'Créer $count fiche${count > 1 ? 's' : ''} de cotisation '
      'pour les membres pas encore listés.';
  String get create => 'Créer';
  String sheetsCreated(int created) =>
      '$created fiche${created > 1 ? 's' : ''} créée${created > 1 ? 's' : ''}';
  String get csvCopied => 'CSV copié dans le presse-papiers';
  String get offlinePaymentSaved => 'Paiement hors-ligne enregistré';
  String validateAid(String label) => 'Valider $label';
  String refuseAid(String label) => 'Refuser $label';
  String get aidValidatedSnack => 'Aide validée';
  String get aidRefusedSnack => 'Aide refusée';
  String categoryColon(String label) => 'catégorie : $label';
  String get adminNote => 'Note admin';
  String get noteSaved => 'Note enregistrée';
  String get configureSeason => 'Configurer la saison';
  String get searchHint => 'Rechercher…';
  String get multiSelectTooltip => 'Sélection multiple';
  String get exportCsvTooltip => 'Exporter CSV';
  String get filterByCategory => 'Filtrer par catégorie';
  String get allCategories => 'Toutes les catégories';
  String unpaidSection(int count) => 'En attente ($count)';
  String paidSection(int count) => 'Payés ($count)';
  String exemptSection(int count) => 'Exonérés ($count)';
  String upToDateSection(int count) => 'À jour ($count)';
  String get privateNoteHint => 'Note privée';

  String trackingStats({
    required int paid,
    required int total,
    required int paidPercent,
    required int exempt,
    required int awaiting,
  }) =>
      '$paid / $total ont payé '
      '($paidPercent %) · '
      '$exempt exonéré${exempt > 1 ? 's' : ''} · '
      '$awaiting en attente';

  String get paymentMethodVirement => 'Virement';
  String get paymentMethodCheque => 'Chèque';
  String get paymentMethodCash => 'Espèces';
  String get paymentMethodAncv => 'Chèques ANCV';
  String get paymentMethodChequesVacances => 'Chèques-vacances';
  String get paymentMethodCard => 'Carte bancaire (HelloAsso)';

  String paymentMethod(String key) => switch (key) {
        'virement' => paymentMethodVirement,
        'cheque' => paymentMethodCheque,
        'especes' => paymentMethodCash,
        'ancv' => paymentMethodAncv,
        'cheques_vacances' => paymentMethodChequesVacances,
        'carte_bancaire' => paymentMethodCard,
        _ => key,
      };

  String get aidPassSport => 'Pass\'Sport';
  String get aidPassPlus => 'Pass+';
  String get aidAncv => 'Chèques ANCV';
  String get aidPromo => 'Code promo';
  String get aidOther => 'Autre aide';

  String aidTypeLabel(String type) => switch (type) {
        'pass_sport' => aidPassSport,
        'pass_plus' => aidPassPlus,
        'ancv' => aidAncv,
        'promo' => aidPromo,
        'other' => aidOther,
        _ => type,
      };

  String get paymentHistoryTitle => 'Historique des paiements';
  String get paymentHistoryEmpty => 'Aucune transaction pour l’instant.';
  String get paymentHistoryLoadError =>
      'Impossible de charger l’historique.';
  String get fieldPaymentHistory => 'Voir l’historique';

  String paymentEventTitle(String type) => switch (type) {
        'offline_credit' => 'Paiement hors-ligne',
        'card_credit' => 'Paiement CB',
        'adjust_absolute' => 'Correction du montant',
        'aid_validated' => 'Aide validée',
        'aid_rejected' => 'Aide refusée',
        'marked_paid' => 'Marqué payé',
        'exempted' => 'Exonération',
        'unexempted' => 'Fin d’exonération',
        _ => 'Mouvement',
      };

  /// Formate un montant en euros pour l’historique.
  String formatEventAmountCents(int cents) {
    final euros = cents / 100;
    final formatted =
        euros.toStringAsFixed(euros.truncateToDouble() == euros ? 0 : 2);
    return '$formatted €';
  }

  /// Montant signé (+ / −) pour un delta d’historique.
  String formatEventDeltaCents(int deltaCents) {
    final sign = deltaCents > 0 ? '+' : '';
    return '$sign${formatEventAmountCents(deltaCents)}';
  }
}
