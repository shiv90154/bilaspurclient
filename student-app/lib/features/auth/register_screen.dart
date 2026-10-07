import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/links.dart';
import '../../data/account_api.dart';
import 'auth_controller.dart';

final _passwordRule = RegExp(r'^(?=.*[A-Za-z])(?=.*\d).{8,128}$');
const _passwordHint = 'At least 8 characters, with a letter and a number';

/// New student sign-up: details → 6 digit email code → logged in as a demo student.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _code = TextEditingController();
  late final Future<List<PublicCourse>> _courses = ref.read(accountApiProvider).courses();
  String? _courseId;
  bool _agree = false;
  bool _hide = true;
  bool _busy = false;
  String? _sentTo; // set once the code was emailed
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _pass, _code]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _guard(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _start() async {
    if (!_form.currentState!.validate()) return;
    if (!_agree) {
      setState(() => _error = 'Please accept the privacy policy and terms.');
      return;
    }
    await _guard(() async {
      final sentTo = await ref.read(accountApiProvider).registerStart(
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            email: _email.text.trim(),
            password: _pass.text,
            courseId: _courseId!,
          );
      setState(() => _sentTo = sentTo);
    });
  }

  Future<void> _verify() async {
    if (!RegExp(r'^\d{6}$').hasMatch(_code.text.trim())) {
      setState(() => _error = 'Enter the 6 digit code from the email.');
      return;
    }
    await _guard(() async {
      await ref.read(accountApiProvider).registerVerify(_email.text.trim(), _code.text.trim());
      // Signed straight in; the router takes over (consent screen, then Home in demo mode).
      await ref.read(authProvider.notifier).login(_phone.text.trim(), _pass.text);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_sentTo == null ? 'Create account' : 'Confirm your email')),
      body: SafeArea(
        child: _sentTo == null ? _detailsForm(context) : _codeForm(context),
      ),
    );
  }

  Widget _detailsForm(BuildContext context) {
    return Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Register, try the free demo, and get full access once the institute approves your admission.'),
          const SizedBox(height: 18),
          TextFormField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Full name', border: OutlineInputBorder()),
            validator: (v) => (v ?? '').trim().length < 2 ? 'Enter your name' : null,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
            decoration: const InputDecoration(
              labelText: 'Mobile number',
              helperText: 'You log in with this',
              border: OutlineInputBorder(),
            ),
            validator: (v) => RegExp(r'^[6-9]\d{9}$').hasMatch(v ?? '') ? null : 'Enter a 10 digit mobile number',
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email',
              helperText: 'We send a code to confirm it',
              border: OutlineInputBorder(),
            ),
            validator: (v) => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch((v ?? '').trim()) ? null : 'Enter a valid email',
          ),
          const SizedBox(height: 14),
          FutureBuilder(
            future: _courses,
            builder: (context, snap) => DropdownButtonFormField<String>(
              initialValue: _courseId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'Course you want to join',
                border: const OutlineInputBorder(),
                errorText: snap.hasError ? 'Could not load courses. Check your internet.' : null,
              ),
              items: [
                for (final c in snap.data ?? const <PublicCourse>[]) DropdownMenuItem(value: c.id, child: Text(c.name)),
              ],
              onChanged: (v) => setState(() => _courseId = v),
              validator: (v) => v == null ? 'Choose a course' : null,
            ),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _pass,
            obscureText: _hide,
            decoration: InputDecoration(
              labelText: 'Password',
              helperText: _passwordHint,
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                tooltip: _hide ? 'Show password' : 'Hide password',
                icon: Icon(_hide ? Icons.visibility : Icons.visibility_off),
                onPressed: () => setState(() => _hide = !_hide),
              ),
            ),
            validator: (v) => _passwordRule.hasMatch(v ?? '') ? null : _passwordHint,
          ),
          const SizedBox(height: 8),
          CheckboxListTile(
            value: _agree,
            onChanged: (v) => setState(() => _agree = v ?? false),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text('I agree to the privacy policy and terms. If I am under 18, my parent/guardian agrees too.'),
          ),
          Wrap(children: [
            TextButton(onPressed: () => openLegalPage(context, 'privacy'), child: const Text('Privacy policy')),
            TextButton(onPressed: () => openLegalPage(context, 'terms'), child: const Text('Terms')),
          ]),
          if (_error != null) _ErrorText(_error!),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy ? null : _start,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: Text(_busy ? 'Sending code…' : 'Continue'),
          ),
        ],
      ),
    );
  }

  Widget _codeForm(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('We sent a 6 digit code to $_sentTo. Check the spam folder too. The code works for 10 minutes.'),
        const SizedBox(height: 18),
        TextField(
          controller: _code,
          keyboardType: TextInputType.number,
          autofillHints: const [AutofillHints.oneTimeCode],
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          style: const TextStyle(fontSize: 24, letterSpacing: 8),
          textAlign: TextAlign.center,
          decoration: const InputDecoration(labelText: 'Code', border: OutlineInputBorder()),
          onSubmitted: (_) => _verify(),
        ),
        if (_error != null) _ErrorText(_error!),
        const SizedBox(height: 18),
        FilledButton(
          onPressed: _busy ? null : _verify,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          child: Text(_busy ? 'Checking…' : 'Confirm and log in'),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: _busy
              ? null
              : () => _guard(() async {
                    await ref.read(accountApiProvider).registerResend(_email.text.trim());
                    if (mounted) {
                      ScaffoldMessenger.of(this.context).showSnackBar(const SnackBar(content: Text('A new code was sent.')));
                    }
                  }),
          child: const Text('Send the code again'),
        ),
        TextButton(
          onPressed: _busy ? null : () => setState(() => _sentTo = null),
          child: const Text('Change my details'),
        ),
      ],
    );
  }
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.message);
  final String message;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Text(message, style: TextStyle(color: Theme.of(context).colorScheme.error)),
      );
}
