import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../widgets/watermark.dart';
import '../auth/auth_controller.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  static const _tiles = [
    (Icons.videocam_outlined, 'Live classes', 'Join scheduled classes'),
    (Icons.menu_book_outlined, 'Study material', 'Notes and PDFs'),
    (Icons.quiz_outlined, 'Tests', 'Practice and mock tests'),
    (Icons.help_outline, 'Doubts', 'Ask your teachers'),
    (Icons.play_circle_outline, 'Recorded lectures', 'Watch anytime'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider.select((s) => s.user))!;

    return Watermark(
      text: '${user.name} · ${user.phone}',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('EduManage'),
          actions: [
            IconButton(
              tooltip: 'Log out',
              icon: const Icon(Icons.logout),
              onPressed: () => ref.read(authProvider.notifier).logout(),
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Hello, ${user.name}',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(user.phone, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 20),
            for (final t in _tiles)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: Icon(t.$1),
                  title: Text(t.$2),
                  subtitle: Text(t.$3),
                  trailing: const Chip(label: Text('Soon')),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
