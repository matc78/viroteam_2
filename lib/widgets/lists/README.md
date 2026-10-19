# Tuiles de liste réutilisables

Chaque type de ligne affiché dans un `ListView` vit ici, un fichier par type
(`<nom>_list_tile.dart`, ex. `member_list_tile.dart`, `member_fee_list_tile.dart`,
`club_activity_list_tile.dart`). Chaque tuile a son test widget minimal dans
`test/widgets/lists/`.

Les écrans dans `features/*/screens/` importent ces tuiles — pas de `itemBuilder` inline volumineux.
