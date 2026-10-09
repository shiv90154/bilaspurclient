import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/links.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../auth/auth_controller.dart';

final myProfileProvider = FutureProvider.autoDispose<MyProfile>((ref) => ref.watch(contentApiProvider).myProfile());
final pendingDeletionProvider =
    FutureProvider.autoDispose<DateTime?>((ref) => ref.watch(contentApiProvider).pendingDeletion());

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will need your phone or email and password to sign in again.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Log out')),
        ],
      ),
    );
    if (ok == true) await ref.read(authProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider.select((s) => s.user));
    if (user == null) return const SizedBox.shrink();
    final profile = ref.watch(myProfileProvider);
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final initial = user.name.trim().isEmpty ? '?' : user.name.trim()[0].toUpperCase();
    final photo = profile.value?.photoUrl;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myProfileProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 8),
            Center(
              child: CircleAvatar(
                radius: 42,
                backgroundColor: scheme.primaryContainer,
                foregroundImage: photo == null ? null : NetworkImage(photo),
                child: Text(initial,
                    style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, color: scheme.onPrimaryContainer)),
              ),
            ),
            const SizedBox(height: 12),
            Center(child: Text(user.name, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
            if (profile.value?.admissionNo != null) ...[
              const SizedBox(height: 4),
              Center(child: Text('Admission no ${profile.value!.admissionNo}', style: text.bodySmall)),
            ],
            const SizedBox(height: 16),
            switch (profile) {
              AsyncData(:final value) => _ProfileBody(p: value, user: user),
              AsyncError(:final error) => Card(
                  child: ListTile(
                    leading: const Icon(Icons.error_outline),
                    title: Text(error is ApiException ? error.message : 'Could not load your profile.'),
                    trailing: TextButton(onPressed: () => ref.invalidate(myProfileProvider), child: const Text('Retry')),
                  ),
                ),
              _ => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
            },
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => const _ChangePasswordSheet(),
              ),
              icon: const Icon(Icons.lock_reset),
              label: const Text('Change password'),
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            ),
            const SizedBox(height: 16),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.info_outline),
                    title: const Text('About DHĪ'),
                    subtitle: const Text('Dr. Pardeuman Singh, your teacher'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/about'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined),
                    title: const Text('Privacy policy'),
                    trailing: const Icon(Icons.open_in_new, size: 18),
                    onTap: () => openLegalPage(context, 'privacy'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.description_outlined),
                    title: const Text('Terms of use'),
                    trailing: const Icon(Icons.open_in_new, size: 18),
                    onTap: () => openLegalPage(context, 'terms'),
                  ),
                  const Divider(height: 1),
                  const _DeleteAccountTile(),
                ],
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => _confirmLogout(context, ref),
              icon: const Icon(Icons.logout),
              label: const Text('Log out'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                foregroundColor: scheme.error,
              ),
            ),
            const SizedBox(height: 24),
            Center(child: Text('DHĪ · Intelligence / Understanding', style: text.bodySmall)),
          ],
        ),
      ),
    );
  }
}

class _ProfileBody extends StatelessWidget {
  const _ProfileBody({required this.p, required this.user});
  final MyProfile p;
  final AppUser user;

  String _pct(double? v) => v == null ? '—' : '${v % 1 == 0 ? v.toInt() : v.toStringAsFixed(1)}%';

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final details = <(IconData, String, String?)>[
      (Icons.phone_outlined, 'Phone', user.phone),
      (Icons.mail_outline, 'Email', user.email),
      (Icons.cake_outlined, 'Date of birth', p.dob == null ? null : DateFormat('d MMM yyyy').format(p.dob!)),
      (Icons.location_city_outlined, 'City', p.city),
      (Icons.home_outlined, 'Address', p.address),
      (Icons.family_restroom_outlined, 'Guardian', p.guardianName),
      (Icons.phone_in_talk_outlined, 'Guardian phone', p.guardianPhone),
      (Icons.flag_outlined, 'Target exam', p.targetExam),
    ].where((d) => d.$3 != null && d.$3!.isNotEmpty).toList();

    Widget stat(String label, String value) => Expanded(
          child: Card(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
              child: Column(
                children: [
                  Text(value, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(label, style: text.bodySmall, textAlign: TextAlign.center),
                ],
              ),
            ),
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(children: [
          stat('Tests', '${p.testsTaken}'),
          stat('Avg score', _pct(p.averagePercentage)),
          stat('Attendance', _pct(p.attendancePercentage)),
        ]),
        const SizedBox(height: 12),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.groups_outlined),
                title: const Text('My batches'),
                subtitle: Text(p.batches.isEmpty ? 'Not in a batch yet' : p.batches.join('\n')),
              ),
              if (p.classesHeld > 0) ...[
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.videocam_outlined),
                  title: const Text('Live classes'),
                  subtitle: Text('Attended ${p.classesAttended} of ${p.classesHeld}'),
                ),
              ],
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.help_outline),
                title: const Text('Doubts asked'),
                subtitle: Text('${p.doubtsAsked}'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Column(
            children: [
              for (final (i, d) in details.indexed) ...[
                if (i > 0) const Divider(height: 1),
                ListTile(leading: Icon(d.$1), title: Text(d.$2), subtitle: Text(d.$3!)),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 8, left: 4),
          child: Text('Something wrong? Ask the institute office to correct it.', style: text.bodySmall),
        ),
      ],
    );
  }
}

class _ChangePasswordSheet extends ConsumerStatefulWidget {
  const _ChangePasswordSheet();

  @override
  ConsumerState<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends ConsumerState<_ChangePasswordSheet> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();
  bool _busy = false;
  String? _error;

  static final _rule = RegExp(r'^(?=.*[A-Za-z])(?=.*\d).{8,128}$');

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(contentApiProvider).changePassword(_current.text, _next.text);
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed. Other devices were logged out.')),
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Change password', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextFormField(
              controller: _current,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current password'),
              validator: (v) => (v ?? '').isEmpty ? 'Enter your current password' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _next,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'New password',
                helperText: 'At least 8 characters, with a letter and a number',
              ),
              validator: (v) => _rule.hasMatch(v ?? '') ? null : 'At least 8 characters, with a letter and a number',
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _repeat,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Repeat new password'),
              validator: (v) => v == _next.text ? null : 'The two passwords are different',
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _busy ? null : _submit,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              child: Text(_busy ? 'Saving…' : 'Change password'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Play Store rule: students can ask for their account and data to be deleted from inside the app.
class _DeleteAccountTile extends ConsumerWidget {
  const _DeleteAccountTile();

  Future<void> _ask(BuildContext context, WidgetRef ref) async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete my account?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'The institute will delete your name, phone, address, guardian details, photo and documents '
              'within 30 days, and you will not be able to log in again. Test scores and attendance stay only '
              'as anonymous numbers.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reason,
              maxLength: 500,
              decoration: const InputDecoration(labelText: 'Reason (optional)', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(dialogContext).colorScheme.error),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Request deletion'),
          ),
        ],
      ),
    );
    final text = reason.text.trim();
    reason.dispose();
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(contentApiProvider).requestDeletion(text);
      ref.invalidate(pendingDeletionProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Request sent. The institute will contact you and delete the account.')),
        );
      }
    } on ApiException catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(pendingDeletionProvider).value;
    final error = Theme.of(context).colorScheme.error;
    return ListTile(
      leading: Icon(Icons.person_remove_outlined, color: error),
      title: Text('Delete my account', style: TextStyle(color: error)),
      subtitle: pending == null ? null : Text('Requested on ${DateFormat('d MMM yyyy').format(pending)}'),
      enabled: pending == null,
      onTap: () => _ask(context, ref),
    );
  }
}
