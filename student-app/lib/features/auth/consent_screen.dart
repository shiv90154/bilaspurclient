import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/links.dart';
import '../../data/content_api.dart';
import 'auth_controller.dart';

/// Shown once after login (and again when the terms change). Students under 18 need a
/// parent/guardian to agree too (India's DPDP Act). Nothing else in the app opens before this.
class ConsentScreen extends ConsumerStatefulWidget {
  const ConsentScreen({super.key});

  @override
  ConsumerState<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends ConsumerState<ConsentScreen> {
  final _form = GlobalKey<FormState>();
  final _guardian = TextEditingController();
  bool _agree = false;
  bool _minor = false;
  bool _guardianAgree = false;
  bool _busy = false;
  String? _error;
  late final Future<({String instituteName, String termsVersion})> _info =
      ref.read(contentApiProvider).privacyInfo();

  @override
  void dispose() {
    _guardian.dispose();
    super.dispose();
  }

  Future<void> _submit(String version) async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(contentApiProvider).acceptConsent(
            version: version,
            guardianName: _minor ? _guardian.text.trim() : null,
          );
      // The router sends the student on to Home once the profile says consent is done.
      await ref.read(authProvider.notifier).refreshProfile();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final ready = _agree && (!_minor || _guardianAgree);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Before you start'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton(onPressed: () => ref.read(authProvider.notifier).logout(), child: const Text('Log out')),
        ],
      ),
      body: FutureBuilder(
        future: _info,
        builder: (context, snap) {
          if (snap.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(snap.error is ApiException ? (snap.error! as ApiException).message : 'Could not load. Check your internet.'),
              ),
            );
          }
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final info = snap.data!;
          return Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text('Your data and the rules', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(
                  '${info.instituteName} stores your name, phone, profile, test results, attendance and doubts to run '
                  'your classes. Screenshots are blocked and study content is for your personal use only. '
                  'Please read the full privacy policy and terms.',
                ),
                const SizedBox(height: 8),
                Wrap(children: [
                  TextButton.icon(
                    onPressed: () => openLegalPage(context, 'privacy'),
                    icon: const Icon(Icons.open_in_new, size: 18),
                    label: const Text('Privacy policy'),
                  ),
                  TextButton.icon(
                    onPressed: () => openLegalPage(context, 'terms'),
                    icon: const Icon(Icons.open_in_new, size: 18),
                    label: const Text('Terms of use'),
                  ),
                ]),
                const Divider(height: 28),
                CheckboxListTile(
                  value: _agree,
                  onChanged: (v) => setState(() => _agree = v ?? false),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: const Text('I have read and agree to the privacy policy and terms of use.'),
                ),
                CheckboxListTile(
                  value: _minor,
                  onChanged: (v) => setState(() => _minor = v ?? false),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: const Text('I am under 18 years old.'),
                ),
                if (_minor) ...[
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _guardian,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Parent / guardian name', border: OutlineInputBorder()),
                    validator: (v) => (v ?? '').trim().length < 2 ? 'Enter the parent or guardian name' : null,
                  ),
                  CheckboxListTile(
                    value: _guardianAgree,
                    onChanged: (v) => setState(() => _guardianAgree = v ?? false),
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: const Text('I am the parent/guardian and I agree for this student.'),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: !ready || _busy ? null : () => _submit(info.termsVersion),
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                  child: Text(_busy ? 'Saving…' : 'Agree and continue'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
