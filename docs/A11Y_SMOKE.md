# Smoke accessibilité (pragmatique)

Checklist manuelle pour valider le niveau « plus qu’acceptable ».  
Pas un audit WCAG : **parcours sans blocage** = done.

Conventions : [`PROJECT_CONVENTIONS.md`](../PROJECT_CONVENTIONS.md) § Accessibilité.  
Hook dialogs portail : `portal/src/lib/ui/useDialogA11y.ts`.

---

## App (VoiceOver iOS ou TalkBack Android)

Parcours : **login → home → RSVP → chat → cotisation**.

| # | Étape | OK |
|---|--------|----|
| 1 | Login : champs e-mail / mdp annoncés ; toggle afficher/masquer mdp nommé | ☐ |
| 2 | Home : chaque club de la barre a un nom ; bouton Discussions (+ non lus si présents) | ☐ |
| 3 | Planning : événement annoncé (titre + heure) ; pastilles RSVP Présent / Absent / En attente | ☐ |
| 4 | Chat : composer — Ajouter (pièce jointe) et Envoyer nommés ; envoi d’un message | ☐ |
| 5 | Ma cotisation : actions icon-only (ex. copier IBAN) avec tooltip / label | ☐ |
| 6 | Pas de piège focus dans un bottom sheet (fermer avec le bouton Fermer / Retour) | ☐ |

**Critère** : chaque action icon-only annonce un nom compréhensible.

---

## Portail (clavier + 1 lecteur d’écran)

Parcours : **login → home → dialog → planning → messagerie**.

| # | Étape | OK |
|---|--------|----|
| 1 | Login Tab-only : labels, erreurs `role="alert"`, toggle mdp | ☐ |
| 2 | Nav modules / famille : landmark (`aria-label`), `aria-current` sur page active | ☐ |
| 3 | Ouvrir un dialog (ex. Ajouter un membre) : focus dans le dialog ; Tab cyclique ; Escape ferme et restore le focus | ☐ |
| 3b | Fiche membre / détail événement : même comportement (useDialogA11y) | ☐ |
| 4 | Planning : flèches période + en-têtes de jour nommés | ☐ |
| 5 | Messagerie dock : boutons icon-only avec `aria-label` ; recherche labellée | ☐ |
| 5b | Thread flottant : Escape ferme ; overlay actions/édition : Escape ferme l’overlay d’abord ; fil `role=log` | ☐ |
| 6 | Tables membres : tri (`aria-sort`) / sélection annoncés | ☐ |
| 7 | Toast annoncé (`aria-live`) | ☐ |

**Critère** : Escape + restore focus sur les dialogs branchés à `useDialogA11y`.

---

## Hors scope (volontaire)

- Audit axe / CI automatisé
- Certification WCAG AA complète
- Couverture 100 % des écrans secondaires
- Dark mode / i18n a11y
