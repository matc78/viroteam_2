/// Part Stripe % (cartes EEE standard).
const double kStripePercent = 0.015;

/// Part Stripe fixe en centimes.
const int kStripeFixedCents = 25;

/// Marge plateforme fixe en centimes (sécurité + revenu).
const int kPlatformFlatCents = 100;

/// Convertit un montant net club (centimes) en montant brut CB membre.
///
/// Formule : gross = (net + fixeStripe + margePlateforme) / (1 − %)
/// Arrondi au centime supérieur pour ne pas laisser la plateforme dans le rouge.
int cardGrossCentsFromNet(int netCents) {
  final net = netCents < 0 ? 0 : netCents;
  if (net <= 0) return 0;
  final fixedEuros = (kStripeFixedCents + kPlatformFlatCents) / 100.0;
  final grossEuros = (net / 100.0 + fixedEuros) / (1 - kStripePercent);
  return (grossEuros * 100).ceil();
}

/// Frais CB affichés (brut − net) pour un montant net club.
int cardFeeCentsFromNet(int netCents) {
  final net = netCents < 0 ? 0 : netCents;
  if (net <= 0) return 0;
  return cardGrossCentsFromNet(net) - net;
}
