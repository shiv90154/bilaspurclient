import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_controller.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  /// (icon, title, subtitle, route). A null route means "not built yet".
  static const _tiles = <(IconData, String, String, String?)>[
    (Icons.menu_book_outlined, 'Study material', 'Notes and PDFs', '/notes'),
    (Icons.quiz_outlined, 'Tests', 'Practice and mock tests', '/tests'),
    (Icons.help_outline, 'Doubts', 'Ask your teachers', '/doubts'),
    (Icons.videocam_outlined, 'Live classes', 'Join scheduled classes', null),
    (Icons.play_circle_outline, 'Recorded lectures', 'Watch anytime', null),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider.select((s) => s.user))!;

    return Scaffold(
      appBar: AppBar(
        title: const Text('DHĪ'),
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
          for (final (icon, title, subtitle, route) in _tiles)
            Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                leading: Icon(icon),
                title: Text(title),
                subtitle: Text(subtitle),
                trailing: route == null ? const Chip(label: Text('Soon')) : const Icon(Icons.chevron_right),
                onTap: route == null ? null : () => context.push(route),
              ),
            ),
        ],
      ),
    );
  }
}
