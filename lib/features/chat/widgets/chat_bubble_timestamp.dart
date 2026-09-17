import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/linkify_message_text.dart';

/// Horodatage bas-droite d’une bulle chat (style WhatsApp).
class ChatBubbleTimestamp extends StatelessWidget {
  const ChatBubbleTimestamp({
    super.key,
    required this.sentAt,
    this.edited = false,
    this.onImage = false,
  });

  final DateTime sentAt;
  final bool edited;

  /// Sur une image : contraste renforcé (fond semi-transparent).
  final bool onImage;

  @override
  Widget build(BuildContext context) {
    final time = formatChatMessageTime(sentAt);
    final label = edited ? '${AppCopy.chat.messageEdited} $time' : time;
    final style = Theme.of(context).textTheme.labelSmall?.copyWith(
          color: onImage ? ViroColors.white : ViroColors.gray400,
          fontWeight: FontWeight.w500,
          height: 1.1,
        );

    final text = Text(label, style: style);
    if (!onImage) return text;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: ViroColors.primary900.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(8),
      ),
      child: text,
    );
  }
}

/// Texte de message avec heure inline en bas à droite (style WhatsApp).
class ChatBubbleTextWithTime extends StatefulWidget {
  const ChatBubbleTextWithTime({
    super.key,
    required this.text,
    required this.sentAt,
    required this.style,
    this.edited = false,
    this.highlightQuery,
  });

  final String text;
  final DateTime sentAt;
  final TextStyle? style;
  final bool edited;

  /// Sous-chaîne à surligner (recherche thread).
  final String? highlightQuery;

  @override
  State<ChatBubbleTextWithTime> createState() => _ChatBubbleTextWithTimeState();
}

class _ChatBubbleTextWithTimeState extends State<ChatBubbleTextWithTime> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant ChatBubbleTextWithTime oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text != widget.text) {
      for (final recognizer in _recognizers) {
        recognizer.dispose();
      }
      _recognizers.clear();
    }
  }

  List<InlineSpan> _buildSpans() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();
    final spans = linkifyInlineSpans(
      widget.text,
      style: widget.style,
      recognizers: _recognizers,
    );
    final query = widget.highlightQuery?.trim();
    if (query == null || query.isEmpty) return spans;
    return _applyHighlight(spans, query);
  }

  List<InlineSpan> _applyHighlight(List<InlineSpan> spans, String query) {
    final lowerQuery = query.toLowerCase();
    final out = <InlineSpan>[];
    for (final span in spans) {
      if (span is! TextSpan || span.text == null) {
        out.add(span);
        continue;
      }
      final text = span.text!;
      final lower = text.toLowerCase();
      var start = 0;
      while (true) {
        final index = lower.indexOf(lowerQuery, start);
        if (index < 0) {
          if (start < text.length) {
            out.add(
              TextSpan(
                text: text.substring(start),
                style: span.style,
                recognizer: span.recognizer,
              ),
            );
          }
          break;
        }
        if (index > start) {
          out.add(
            TextSpan(
              text: text.substring(start, index),
              style: span.style,
              recognizer: span.recognizer,
            ),
          );
        }
        out.add(
          TextSpan(
            text: text.substring(index, index + query.length),
            style: (span.style ?? const TextStyle()).copyWith(
              backgroundColor: ViroColors.warning.withValues(alpha: 0.35),
            ),
            recognizer: span.recognizer,
          ),
        );
        start = index + query.length;
      }
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final timestamp = ChatBubbleTimestamp(
      sentAt: widget.sentAt,
      edited: widget.edited,
    );

    return Stack(
      children: [
        Text.rich(
          TextSpan(
            style: widget.style,
            children: [
              ..._buildSpans(),
              WidgetSpan(
                alignment: PlaceholderAlignment.baseline,
                baseline: TextBaseline.alphabetic,
                child: Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Opacity(
                    opacity: 0,
                    child: timestamp,
                  ),
                ),
              ),
            ],
          ),
        ),
        Positioned(
          right: 0,
          bottom: 0,
          child: timestamp,
        ),
      ],
    );
  }
}
