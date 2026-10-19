# Smoke notifications push

Checklist manuelle avant une release qui touche aux push (app, Functions ou index Firestore).
À dérouler sur **un Android 13+**, **un Android ≤ 12** et **un iPhone**, en dev (`v2-dev`, build debug) puis en prod (build store).

Code : `lib/services/push_notification_service.dart` (orchestration), `local_notification_service.dart` (affichage app ouverte + canaux Android), `foreground_push_policy.dart` (filtre), `notification_permission_service.dart` / `notification_soft_ask_service.dart` (permission) ; serveur : `functions/src/notifications/` (`fcmMessage.ts` pour canal / tag).

Diagnostic : chaque envoi logge `push sent` (`targetedUids`, `allowedUids`, `tokens`, `success`, `failure`) —
`firebase functions:log --only onAnnouncementCreatedForPush --project viroteam-75303`.

---

## Permission

| # | Étape | OK |
|---|--------|----|
| 1 | Install neuve + login : **aucune** popup système au lancement | ☐ |
| 2 | Home avec un club : pré-demande « Ne rate plus une convocation » après ~1 s | ☐ |
| 3 | « Plus tard » : la sheet ne revient pas avant 7 jours (ni au relancement de l’app) | ☐ |
| 4 | « Activer les notifs » : popup système ; si accordé, toast de confirmation | ☐ |
| 5 | Refus définitif (iOS : 1 refus ; Android 13+ : 2 refus) : Paramètres > Notifications affiche le bandeau, interrupteurs grisés ; « Autoriser les notifs » ouvre les réglages du téléphone | ☐ |
| 6 | Autoriser depuis les réglages puis revenir dans l’app : le bandeau disparaît sans relancer | ☐ |

## Réception

Envoyer une annonce « Tous les membres » depuis le portail, puis modifier un événement.

| # | État de l’app | Attendu | OK |
|---|---------------|---------|----|
| 7 | Premier plan, sur la home | Bannière système (Android **et** iOS) | ☐ |
| 8 | Arrière-plan | Bannière ; icône monochrome + teinte bleue sur Android | ☐ |
| 9 | App tuée | Bannière ; tap → ouvre l’app sur le bon écran | ☐ |
| 10 | Tap sur la bannière (premier plan / arrière-plan) | Navigation vers home (annonce) / planning (événement) | ☐ |
| 11 | Événement modifié deux fois | Une seule notif dans le tiroir (la plus récente) | ☐ |
| 12 | Android : Réglages > Notifications de l’app | Canaux Événements, Annonces, Cotisations, Réponses de présence (+ Messages si chat live) | ☐ |
| 13 | Chat (si `chatMessagingLive`) : message dans la conversation ouverte | **Pas** de bannière ; message d’une autre conversation → bannière | ☐ |

**Critère** : une annonce « Tous les membres » est reçue par chaque membre ayant autorisé les notifs, dans les 3 états de l’app.
