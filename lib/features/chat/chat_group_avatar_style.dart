import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';

/// Fond d’avatar icône pour un [ConversationGroupAvatarTone].
///
/// Canal = violet admin, équipe = bleu d'accent de la [palette] (thème
/// courant), parents / groupe = vert.
Color colorForConversationGroupAvatarTone(
  ConversationGroupAvatarTone tone, {
  required ViroPalette palette,
}) {
  return switch (tone) {
    ConversationGroupAvatarTone.channel => ViroColors.adminBadgeEnd,
    ConversationGroupAvatarTone.team => palette.accentFill,
    ConversationGroupAvatarTone.parents ||
    ConversationGroupAvatarTone.group =>
      ViroColors.sportGreen,
  };
}
