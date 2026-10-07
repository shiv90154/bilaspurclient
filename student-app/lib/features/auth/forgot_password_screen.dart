import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../data/account_api.dart';

final _passwordRule = RegExp(r'^(?=.*[A-Za-z])(?=.*\d).{8,128}$');
const _passwordHint = 'At least 8 characters, with a letter and a number';

/// Phone or email → 6 digit code to the account's email → new password.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _id = TextEditingController();
  final _code = TextEditingController();
  final _pass = TextEditingController();
  final _repeat = TextEditingController();
  String? _notice; // set once a code was (maybe) sent
  bool _busy = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_id, _code, _pass, _repeat]) {
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

  Future<void> _send() async {
    if (_id.text.trim().isEmpty) {
      setState(() => _error = 'Enter your phone number or email.');
      return;
    }
    await _guard(() async {
      final msg = await ref.read(accountApiProvider).forgot(_id.text.trim());
      setState(() => _notice = msg);
    });
  }

  Future<void> _reset() async {
    if (!RegExp(r'^\d{6}$').hasMatch(_code.text.trim())) {
      setState(() => _error = 'Enter the 6 digit code from the email.');
      return;
    }
    if (!_passwordRule.hasMatch(_pass.text)) {
      setState(() => _error = _passwordHint);
      return;
    }
    if (_pass.text != _repeat.text) {
      setState(() => _error = 'The two passwords are different.');
      return;
    }
    await _guard(() async {
      await ref.read(accountApiProvider).reset(_id.text.trim(), _code.text.trim(), _pass.text);
      setState(() => _done = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final error = _error == null
        ? null
        : Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          );
    return Scaffold(
      appBar: AppBar(title: const Text('Forgot password')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (_done) ...[
              const Icon(Icons.check_circle_outline, size: 56, color: Colors.green),
              const SizedBox(height: 12),
              const Text('Password changed. Every device was logged out. Log in with your new password.',
                  textAlign: TextAlign.center),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => Navigator.of(context).maybePop(),
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: const Text('Back to log in'),
              ),
            ] else ...[
              const Text('We email a 6 digit code to the address on your account.'),
              const SizedBox(height: 16),
              TextField(
                controller: _id,
                enabled: _notice == null,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Phone number or email', border: OutlineInputBorder()),
              ),
              if (_notice == null) ...[
                ?error,
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: _busy ? null : _send,
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                  child: Text(_busy ? 'Sending…' : 'Send code'),
                ),
              ] else ...[
                const SizedBox(height: 14),
                Text(_notice!),
                const SizedBox(height: 14),
                TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                  decoration: const InputDecoration(labelText: '6 digit code', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _pass,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'New password',
                    helperText: _passwordHint,
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _repeat,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Repeat new password', border: OutlineInputBorder()),
                ),
                ?error,
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: _busy ? null : _reset,
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                  child: Text(_busy ? 'Saving…' : 'Set new password'),
                ),
                TextButton(onPressed: _busy ? null : _send, child: const Text('Send the code again')),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
