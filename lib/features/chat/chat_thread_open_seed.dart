import 'package:flutter/material.dart';

/// Données chrome passées à l’open du fil (titre / avatar dès le 1er frame).
///
/// Transmises via `GoRouterState.extra` depuis l’inbox — comme WhatsApp
/// qui peint le header depuis la tuile avant le réseau.
class ChatThreadOpenSeed {
  ChatThreadOpenSeed({
    required this.title,
    required this.clubColor,
    String? initial,
    this.avatarUrl,
    this.isGroup = false,
    this.isChannel = false,
  }) : initial = avatarInitialFromTitle(initial ?? title);

  final String title;
  final Color clubColor;
  final String initial;

  /// Photo (pair DM ou avatar groupe) pour peindre dès le 1er frame.
  final String? avatarUrl;

  /// Même chrome avatar que la tuile inbox (icône groupe / canal).
  final bool isGroup;
  final bool isChannel;

  /// Tag Hero partagé liste ↔ AppBar.
  static String avatarHeroTag(String clubId, String conversationId) =>
      'chat-avatar-$clubId-$conversationId';
}

/// Première lettre significative pour la pastille avatar.
String avatarInitialFromTitle(String title) {
  final trimmed = title.trim();
  if (trimmed.isEmpty) return '?';
  return trimmed.substring(0, 1).toUpperCase();
}
