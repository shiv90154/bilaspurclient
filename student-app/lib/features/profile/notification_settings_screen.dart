import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

/// Which pushes the student gets. Changes save at once; a failed save puts the switch back.
class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen> {
  AsyncValue<NotifyPrefs> _prefs = const AsyncLoading();
  String? _saving;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _prefs = const AsyncLoading());
    final next = await AsyncValue.guard(() => ref.read(contentApiProvider).notifyPrefs());
    if (mounted) setState(() => _prefs = next);
  }

  Future<void> _set(String key, bool on) async {
    setState(() => _saving = key);
    try {
      final saved = await ref.read(contentApiProvider).setNotifyPref(key, on);
      if (mounted) setState(() => _prefs = AsyncData(saved));
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _saving = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: AsyncView(
        value: _prefs,
        onRetry: _load,
        builder: (p) {
          Widget tile(String key, IconData icon, String title, String subtitle, bool value) => SwitchListTile(
                secondary: Icon(icon),
                title: Text(title),
                subtitle: Text(subtitle),
                value: value,
                onChanged: _saving == null ? (on) => _set(key, on) : null,
              );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Card(
                child: Column(children: [
                  tile('classReminders', Icons.alarm, 'Class reminders', 'A few minutes before a live class starts',
                      p.classReminders),
                  const Divider(height: 1),
                  tile('recordings', Icons.ondemand_video_outlined, 'Class recordings',
                      'When the recording of a class is ready', p.recordings),
                  const Divider(height: 1),
                  tile('doubtReplies', Icons.forum_outlined, 'Doubt replies', 'When a teacher answers your doubt',
                      p.doubtReplies),
                  const Divider(height: 1),
                  tile('testResults', Icons.fact_check_outlined, 'Test results', 'When your written answers are checked',
                      p.testResults),
                ]),
              ),
              const SizedBox(height: 8),
              Text(
                'You always get a notification when a class is cancelled or moved, and when the institute '
                'checks a document you uploaded.',
                style: text.bodySmall,
              ),
            ],
          );
        },
      ),
    );
  }
}
