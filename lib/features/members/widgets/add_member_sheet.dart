import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

class AddMemberSheet extends StatefulWidget {
  const AddMemberSheet({super.key});

  @override
  State<AddMemberSheet> createState() => _AddMemberSheetState();
}

class _AddMemberSheetState extends State<AddMemberSheet> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  String _role = MemberRoles.player;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  bool get _isValid =>
      _firstNameController.text.trim().isNotEmpty &&
      _lastNameController.text.trim().isNotEmpty;

  void _submit() {
    if (!_isValid) return;
    final result = (
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      role: _role,
    );
    Navigator.of(context).pop<AddMemberFormResult>(result);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final titleColor = theme.appBarTheme.foregroundColor;
    final accent = theme.colorScheme.primary;
    final onAccent = theme.colorScheme.onPrimary;

    return Padding(
      padding: EdgeInsets.only(
        left: ViroSpacing.lg,
        right: ViroSpacing.lg,
        top: ViroSpacing.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + ViroSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Ajouter un membre',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: titleColor,
                ),
          ),
          const SizedBox(height: ViroSpacing.lg),
          TextField(
            controller: _firstNameController,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Prénom *',
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: ViroSpacing.md),
          TextField(
            controller: _lastNameController,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Nom *',
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: ViroSpacing.md),
          SegmentedButton<String>(
            style: ClubAccentTheme.segmentedButtonStyle(accent, onAccent),
            segments: const [
              ButtonSegment(
                value: MemberRoles.player,
                label: Text('Joueur'),
              ),
              ButtonSegment(
                value: MemberRoles.coach,
                label: Text('Coach'),
              ),
            ],
            selected: {_role},
            onSelectionChanged: (set) => setState(() => _role = set.first),
          ),
          const SizedBox(height: ViroSpacing.lg),
          ViroPrimaryButton(
            label: 'Ajouter',
            onPressed: _isValid ? _submit : null,
          ),
        ],
      ),
    );
  }
}

typedef AddMemberFormResult = ({
  String firstName,
  String lastName,
  String role,
});

Future<AddMemberFormResult?> showAddMemberSheet(
  BuildContext context, {
  required Color accentColor,
}) {
  return showModalBottomSheet<AddMemberFormResult>(
    context: context,
    isScrollControlled: true,
    builder: (_) => ClubAccentTheme(
      accentColor: accentColor,
      child: const AddMemberSheet(),
    ),
  );
}
