import 'package:flutter/material.dart';

/// Vignette photo de la galerie « Médias » d’une conversation.
class ChatMediaListTile extends StatelessWidget {
  const ChatMediaListTile({
    super.key,
    required this.imageUrl,
    this.onTap,
  });

  final String imageUrl;
  final VoidCallback? onTap;

  static const double size = 88;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          imageUrl,
          width: size,
          height: size,
          fit: BoxFit.cover,
          // Même emprise vide que sans errorBuilder, sans remonter l’erreur.
          errorBuilder: (_, _, _) => const SizedBox.square(dimension: size),
        ),
      ),
    );
  }
}
