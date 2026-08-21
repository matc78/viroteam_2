import 'package:flutter/material.dart';

/// [RefreshIndicator] partagé pour les écrans branchés sur Firestore.
class ViroRefreshIndicator extends StatelessWidget {
  const ViroRefreshIndicator({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: child,
    );
  }
}
