import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';
import '../auth/auth_controller.dart';
import 'profile_screen.dart';

/// Camera / gallery / remove, then uploads. The picker shrinks the picture so it stays well under
/// the server's 3 MB limit; the avatar is drawn as a circle, so no cropping is needed.
Future<void> changeProfilePhoto(BuildContext context, WidgetRef ref, {required bool hasPhoto}) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    builder: (sheet) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const ListTile(title: Text('Profile photo', style: TextStyle(fontWeight: FontWeight.w700))),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Take a photo'),
            onTap: () => Navigator.pop(sheet, 'camera'),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Choose from gallery'),
            onTap: () => Navigator.pop(sheet, 'gallery'),
          ),
          if (hasPhoto)
            ListTile(
              leading: Icon(Icons.delete_outline, color: Theme.of(sheet).colorScheme.error),
              title: Text('Remove photo', style: TextStyle(color: Theme.of(sheet).colorScheme.error)),
              onTap: () => Navigator.pop(sheet, 'remove'),
            ),
        ],
      ),
    ),
  );
  if (choice == null || !context.mounted) return;
  final api = ref.read(contentApiProvider);
  final messenger = ScaffoldMessenger.of(context);
  try {
    if (choice == 'remove') {
      await api.removePhoto();
      messenger.showSnackBar(const SnackBar(content: Text('Photo removed')));
    } else {
      final shot = await ImagePicker().pickImage(
        source: choice == 'camera' ? ImageSource.camera : ImageSource.gallery,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );
      if (shot == null) return;
      messenger.showSnackBar(const SnackBar(content: Text('Uploading photo…'), duration: Duration(seconds: 20)));
      await api.uploadPhoto(shot.path);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Photo updated')));
    }
    ref.invalidate(myProfileProvider);
  } catch (e) {
    messenger.hideCurrentSnackBar();
    if (context.mounted) showError(context, e is ApiException ? e : ApiException.from(e));
  }
}

/// Address, city and guardian: the details a student may keep up to date themself.
class EditDetailsSheet extends ConsumerStatefulWidget {
  const EditDetailsSheet({super.key, required this.profile});
  final MyProfile profile;

  @override
  ConsumerState<EditDetailsSheet> createState() => _EditDetailsSheetState();
}

class _EditDetailsSheetState extends ConsumerState<EditDetailsSheet> {
  final _form = GlobalKey<FormState>();
  late final _address = TextEditingController(text: widget.profile.address ?? '');
  late final _city = TextEditingController(text: widget.profile.city ?? '');
  late final _guardian = TextEditingController(text: widget.profile.guardianName ?? '');
  late final _guardianPhone = TextEditingController(text: widget.profile.guardianPhone ?? '');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _address.dispose();
    _city.dispose();
    _guardian.dispose();
    _guardianPhone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(contentApiProvider).updateProfile({
        'address': _address.text.trim(),
        'city': _city.text.trim(),
        'guardianName': _guardian.text.trim(),
        'guardianPhone': _guardianPhone.text.trim(),
      });
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Details saved')));
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
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Edit my details', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text('Name, phone and date of birth are changed by the institute office.',
                  style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 16),
              TextFormField(
                controller: _address,
                maxLength: 500,
                minLines: 1,
                maxLines: 3,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(labelText: 'Address', counterText: ''),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _city,
                maxLength: 100,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'City', counterText: ''),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _guardian,
                maxLength: 100,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Guardian name', counterText: ''),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _guardianPhone,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                decoration: const InputDecoration(labelText: 'Guardian phone', counterText: ''),
                validator: (v) {
                  final t = (v ?? '').trim();
                  return t.isEmpty || RegExp(r'^[6-9]\d{9}$').hasMatch(t) ? null : 'Enter a 10 digit mobile number';
                },
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _busy ? null : _save,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: Text(_busy ? 'Saving…' : 'Save'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Two steps: the new email gets a 6-digit code; the right code makes it the account's email.
class ChangeEmailSheet extends ConsumerStatefulWidget {
  const ChangeEmailSheet({super.key, this.current});
  final String? current;

  @override
  ConsumerState<ChangeEmailSheet> createState() => _ChangeEmailSheetState();
}

class _ChangeEmailSheetState extends ConsumerState<ChangeEmailSheet> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  String? _sentTo; // masked address once the code is on its way
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _go(Future<void> Function() step) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await step();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _send() => _go(() async {
        final email = _email.text.trim().toLowerCase();
        if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
          setState(() => _error = 'Enter a valid email');
          return;
        }
        final masked = await ref.read(contentApiProvider).changeEmailStart(email);
        setState(() => _sentTo = masked);
      });

  Future<void> _verify() => _go(() async {
        if (!RegExp(r'^\d{6}$').hasMatch(_code.text.trim())) {
          setState(() => _error = 'Enter the 6-digit code');
          return;
        }
        await ref.read(contentApiProvider).changeEmailVerify(_email.text.trim().toLowerCase(), _code.text.trim());
        await ref.read(authProvider.notifier).refreshProfile();
        if (!mounted) return;
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Email changed')));
      });

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.current == null ? 'Add email' : 'Change email', style: text.titleLarge),
          const SizedBox(height: 4),
          Text(
            _sentTo == null
                ? 'We send a code to the new email to make sure it is yours. You can log in with it and get password reset codes there.'
                : 'We sent a 6-digit code to $_sentTo. It works for 10 minutes.',
            style: text.bodySmall,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _email,
            enabled: _sentTo == null,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'New email'),
          ),
          if (_sentTo != null) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _code,
              autofocus: true,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(labelText: '6-digit code', counterText: ''),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: _busy
                    ? null
                    : () => setState(() {
                          _sentTo = null;
                          _code.clear();
                          _error = null;
                        }),
                child: const Text('Use a different email'),
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : (_sentTo == null ? _send : _verify),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: Text(_busy ? 'Please wait…' : (_sentTo == null ? 'Send code' : 'Confirm')),
          ),
        ],
      ),
    );
  }
}
