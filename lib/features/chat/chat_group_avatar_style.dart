import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/models/chat_conversation.dart';

/// Fond d’avatar icône pour un [ConversationGroupAvatarTone].
///
/// Canal = violet admin, équipe = bleu primary600, parents / groupe = vert.
Color colorForConversationGroupAvatarTone(ConversationGroupAvatarTone tone) {
  return switch (tone) {
    ConversationGroupAvatarTone.channel => ViroColors.adminBadgeEnd,
    ConversationGroupAvatarTone.team => ViroColors.primary600,
    ConversationGroupAvatarTone.parents ||
    ConversationGroupAvatarTone.group =>
      ViroColors.sportGreen,
  };
}
