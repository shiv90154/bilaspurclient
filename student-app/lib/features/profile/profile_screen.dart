import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/api_client.dart';
import '../../core/links.dart';
import '../../core/theme.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../auth/auth_controller.dart';

final myProfileProvider = FutureProvider.autoDispose<MyProfile>((ref) => ref.watch(contentApiProvider).myProfile());
final pendingDeletionProvider =
    FutureProvider.autoDispose<DateTime?>((ref) => ref.watch(contentApiProvider).pendingDeletion());
final _appVersionProvider = FutureProvider<String>((ref) async {
  final info = await PackageInfo.fromPlatform();
  return '${info.version} (${info.buildNumber})';
});

/// Green when on track, gold when slipping, red when it needs attention.
Color _pctColor(ColorScheme s, double? v) => v == null
    ? s.outline
    : v >= 75
        ? AppTheme.forest
        : v >= 50
            ? AppTheme.gold
            : s.error;

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
    final version = ref.watch(_appVersionProvider).value;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myProfileProvider.future),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            _Header(user: user, profile: profile.value),
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
            const _SectionTitle('Account & app'),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.lock_reset),
                    title: const Text('Change password'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      builder: (_) => const _ChangePasswordSheet(),
                    ),
                  ),
                  const Divider(height: 1),
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
                side: BorderSide(color: scheme.error.withValues(alpha: 0.4)),
              ),
            ),
            const SizedBox(height: 24),
            Center(child: Text('DHĪ · Intelligence / Understanding', style: text.bodySmall)),
            if (version != null)
              Center(
                child: Text('Version $version', style: text.bodySmall?.copyWith(color: scheme.outline)),
              ),
          ],
        ),
      ),
    );
  }
}

/// Green card at the top: photo, name and the two things a student is known by here.
class _Header extends StatelessWidget {
  const _Header({required this.user, required this.profile});
  final AppUser user;
  final MyProfile? profile;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final initial = user.name.trim().isEmpty ? '?' : user.name.trim()[0].toUpperCase();
    final photo = profile?.photoUrl;
    final contact = user.phone.isNotEmpty ? user.phone : user.email;

    Widget pill(IconData icon, String label) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 15, color: const Color(0xFFE9C987)),
              const SizedBox(width: 6),
              Flexible(
                child: Text(label,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        );

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [AppTheme.forest, AppTheme.forestDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppTheme.gold, width: 2.5)),
            child: CircleAvatar(
              radius: 44,
              backgroundColor: AppTheme.cream,
              foregroundImage: photo == null ? null : NetworkImage(photo),
              child: Text(initial,
                  style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, color: AppTheme.forest)),
            ),
          ),
          const SizedBox(height: 12),
          Text(user.name,
              textAlign: TextAlign.center,
              style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, color: Colors.white)),
          if (contact != null && contact.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(contact, style: text.bodySmall?.copyWith(color: Colors.white70)),
          ],
          if (profile?.admissionNo != null || (profile?.targetExam?.isNotEmpty ?? false)) ...[
            const SizedBox(height: 14),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                if (profile?.admissionNo != null) pill(Icons.badge_outlined, 'Adm. no ${profile!.admissionNo}'),
                if (profile?.targetExam?.isNotEmpty ?? false) pill(Icons.flag_outlined, profile!.targetExam!),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
        child: Text(
          label.toUpperCase(),
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      );
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.icon, required this.label, required this.value, required this.color, this.progress, this.onTap});
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final double? progress; // 0–100; null hides the bar
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(height: 10),
              Text(value, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
              Text(label, style: text.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
              const Spacer(),
              if (progress != null) ...[
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: (progress! / 100).clamp(0, 1),
                  minHeight: 5,
                  borderRadius: BorderRadius.circular(4),
                  color: color,
                  backgroundColor: color.withValues(alpha: 0.15),
                ),
              ],
            ],
          ),
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

  Widget _detailsCard(BuildContext context, List<(IconData, String, String?)> rows) {
    final shown = rows.where((d) => d.$3 != null && d.$3!.isNotEmpty).toList();
    if (shown.isEmpty) return const SizedBox.shrink();
    return Card(
      child: Column(
        children: [
          for (final (i, d) in shown.indexed) ...[
            if (i > 0) const Divider(height: 1, indent: 56),
            ListTile(
              leading: Icon(d.$1),
              title: Text(d.$2, style: Theme.of(context).textTheme.bodySmall),
              subtitle: Text(d.$3!, style: Theme.of(context).textTheme.bodyLarge),
              onLongPress: () {
                Clipboard.setData(ClipboardData(text: d.$3!));
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${d.$2} copied')));
              },
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final classesPct = p.classesHeld == 0 ? null : p.classesAttended * 100 / p.classesHeld;

    final contact = <(IconData, String, String?)>[
      (Icons.phone_outlined, 'Phone', user.phone),
      (Icons.mail_outline, 'Email', user.email),
      (Icons.location_city_outlined, 'City', p.city),
      (Icons.home_outlined, 'Address', p.address),
    ];
    final personal = <(IconData, String, String?)>[
      (Icons.cake_outlined, 'Date of birth', p.dob == null ? null : DateFormat('d MMM yyyy').format(p.dob!)),
      (Icons.family_restroom_outlined, 'Guardian', p.guardianName),
      (Icons.phone_in_talk_outlined, 'Guardian phone', p.guardianPhone),
    ];
    final hasPersonal = personal.any((d) => d.$3 != null && d.$3!.isNotEmpty);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 150,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _StatTile(
                  icon: Icons.quiz_outlined,
                  label: 'Tests taken',
                  value: '${p.testsTaken}',
                  color: scheme.tertiary,
                  onTap: () => context.go('/tests'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _StatTile(
                  icon: Icons.emoji_events_outlined,
                  label: 'Avg score',
                  value: _pct(p.averagePercentage),
                  color: _pctColor(scheme, p.averagePercentage),
                  progress: p.averagePercentage,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _StatTile(
                  icon: Icons.event_available_outlined,
                  label: 'Attendance',
                  value: _pct(p.attendancePercentage),
                  color: _pctColor(scheme, p.attendancePercentage),
                  progress: p.attendancePercentage,
                ),
              ),
            ],
          ),
        ),
        const _SectionTitle('My learning'),
        Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(Icons.groups_outlined, color: scheme.primary),
                      const SizedBox(width: 16),
                      Text('My batches', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                    ]),
                    const SizedBox(height: 10),
                    if (p.batches.isEmpty)
                      Text('Not in a batch yet', style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant))
                    else
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [for (final b in p.batches) Chip(label: Text(b))],
                      ),
                  ],
                ),
              ),
              if (classesPct != null) ...[
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.videocam_outlined),
                  title: const Text('Live classes'),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Attended ${p.classesAttended} of ${p.classesHeld}'),
                        const SizedBox(height: 6),
                        LinearProgressIndicator(
                          value: (classesPct / 100).clamp(0, 1),
                          minHeight: 5,
                          borderRadius: BorderRadius.circular(4),
                          color: _pctColor(scheme, classesPct),
                          backgroundColor: _pctColor(scheme, classesPct).withValues(alpha: 0.15),
                        ),
                      ],
                    ),
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/classes'),
                ),
              ],
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.help_outline),
                title: const Text('Doubts asked'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${p.doubtsAsked}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right),
                  ],
                ),
                onTap: () => context.go('/doubts'),
              ),
            ],
          ),
        ),
        const _SectionTitle('Contact'),
        _detailsCard(context, contact),
        if (hasPersonal) ...[
          const _SectionTitle('Personal & guardian'),
          _detailsCard(context, personal),
        ],
        Padding(
          padding: const EdgeInsets.only(top: 8, left: 4),
          child: Row(
            children: [
              Icon(Icons.info_outline, size: 14, color: scheme.onSurfaceVariant),
              const SizedBox(width: 6),
              Expanded(
                child: Text('Something wrong? Ask the institute office to correct it. Long-press a detail to copy it.',
                    style: text.bodySmall),
              ),
            ],
          ),
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
